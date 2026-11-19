using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using StockApi.Data;
using StockApi.Models;
using StockApi.Services;

namespace StockApi.Controllers
{
    public class ClienteRequest
    {
        [Required, MaxLength(150)]
        public string Nombre { get; set; } = string.Empty;
        public int DocTipo { get; set; } = TiposDocumento.Dni;
        public string DocNro { get; set; } = string.Empty;
        public int CondicionIvaId { get; set; } = CondicionesIvaArca.ConsumidorFinal;
        [MaxLength(250)]
        public string? Domicilio { get; set; }
        [MaxLength(30)]
        public string? Telefono { get; set; }
    }

    public class FacturarRequest
    {
        /// <summary>Cliente guardado. Si es null y no viene <see cref="Cliente"/>, se factura a consumidor final.</summary>
        public int? ClienteId { get; set; }

        /// <summary>Cliente nuevo (con CUIT o DNI).</summary>
        public ClienteRequest? Cliente { get; set; }

        /// <summary>Guardar el cliente nuevo para la próxima.</summary>
        public bool Guardar { get; set; }
    }

    public class DatosFiscalesRequest
    {
        [MaxLength(150)] public string? RazonSocial { get; set; }
        public string? Cuit { get; set; }
        [MaxLength(250)] public string? DomicilioComercial { get; set; }
        [MaxLength(30)] public string? IngresosBrutos { get; set; }
        public DateTime? InicioActividades { get; set; }
        public int PuntoVenta { get; set; } = 1;
        [MaxLength(250)] public string? MensajePie { get; set; }
    }

    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class FacturacionController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly ArcaService _arca;
        private readonly FacturacionService _facturacion;
        private readonly IMemoryCache _cache;

        public FacturacionController(AppDbContext db, ArcaService arca, FacturacionService facturacion, IMemoryCache cache)
        {
            _db = db;
            _arca = arca;
            _facturacion = facturacion;
            _cache = cache;
        }

        private BadRequestObjectResult Error(string mensaje) => BadRequest(new { message = mensaje });

        // =====================================================================
        // Estado y datos fiscales
        // =====================================================================

        // GET api/facturacion/estado?probar=true
        [HttpGet("estado")]
        public async Task<ActionResult<object>> Estado([FromQuery] bool probar = false, CancellationToken ct = default)
        {
            var config = await ConfiguracionService.ObtenerAsync(_db);
            var cert = _arca.Certificado;
            object? prueba = null;

            if (probar)
            {
                if (!Roles.EsGestion(User.Rol())) return Forbid();
                var pasos = new List<string>();
                var ok = false;
                try
                {
                    var (dummyOk, detalle) = await _arca.DummyAsync(ct);
                    pasos.Add($"Servidores de ARCA: {(dummyOk ? "OK" : "con problemas")} ({detalle})");
                    var cuit = _arca.CuitEmisor ?? throw new ArcaException(cert.Error ?? "Falta el certificado.");
                    await _arca.AccesoAsync(_db, ct);
                    pasos.Add("Permiso de acceso (certificado): OK");
                    var ultimo = await _arca.UltimoAutorizadoAsync(_db, cuit, config.PuntoVenta, TiposComprobante.FacturaC, ct);
                    pasos.Add($"Punto de venta {config.PuntoVenta}: última Factura C N° {ultimo}");
                    ok = dummyOk;
                }
                catch (ArcaException ex)
                {
                    pasos.Add(ex.Message);
                }
                prueba = new { ok, pasos };
            }

            return Ok(new
            {
                entorno = _arca.Entorno,
                esProduccion = _arca.EsProduccion,
                certificado = new
                {
                    cargado = cert.Cargado,
                    cuit = cert.Cuit == null ? null : Documentos.FormatearCuit(cert.Cuit),
                    vence = cert.Vence,
                    error = cert.Error,
                },
                cuitEmisor = _arca.CuitEmisor == null ? null : Documentos.FormatearCuit(_arca.CuitEmisor),
                puntoVenta = config.PuntoVenta,
                prueba,
            });
        }

        // GET api/facturacion/datos
        [HttpGet("datos")]
        public async Task<ActionResult<object>> GetDatos()
        {
            var c = await ConfiguracionService.ObtenerAsync(_db);
            return Ok(new
            {
                c.RazonSocial,
                cuit = Documentos.FormatearCuit(_arca.CuitEmisor ?? c.Cuit),
                cuitDelCertificado = _arca.CuitEmisor != null,
                c.DomicilioComercial,
                c.IngresosBrutos,
                c.InicioActividades,
                condicionIva = "Responsable Monotributo",
                c.PuntoVenta,
                c.MensajePie,
            });
        }

        // PUT api/facturacion/datos
        [HttpPut("datos")]
        [Authorize(Roles = Roles.Gestion)]
        public async Task<ActionResult<object>> PutDatos([FromBody] DatosFiscalesRequest req)
        {
            if (req.PuntoVenta < 1 || req.PuntoVenta > 99999) return Error("Punto de venta inválido.");
            var cuit = Documentos.SoloDigitos(req.Cuit);
            if (cuit.Length > 0 && !Documentos.CuitValido(cuit)) return Error("El CUIT no es válido.");

            var c = await ConfiguracionService.ObtenerAsync(_db);
            c.RazonSocial = req.RazonSocial?.Trim();
            if (_arca.CuitEmisor == null) c.Cuit = cuit.Length > 0 ? cuit : null;
            else c.Cuit = _arca.CuitEmisor;
            c.DomicilioComercial = req.DomicilioComercial?.Trim();
            c.IngresosBrutos = req.IngresosBrutos?.Trim();
            c.InicioActividades = req.InicioActividades;
            c.PuntoVenta = req.PuntoVenta;
            c.MensajePie = req.MensajePie?.Trim();
            c.CondicionFiscal = CondicionesIva.Monotributo;
            await _db.SaveChangesAsync();
            return await GetDatos();
        }

        // GET api/facturacion/condiciones-iva  (lista de ARCA, guardada un día)
        [HttpGet("condiciones-iva")]
        public async Task<ActionResult<object>> GetCondicionesIva(CancellationToken ct)
        {
            var clave = $"arca_condiciones_iva_{_arca.Entorno}";
            if (!_cache.TryGetValue(clave, out List<(int Id, string Nombre)>? lista))
            {
                try
                {
                    var cuit = _arca.CuitEmisor;
                    lista = cuit == null ? null : await _arca.CondicionesIvaAsync(_db, cuit, ct);
                    if (lista is { Count: > 0 }) _cache.Set(clave, lista, TimeSpan.FromDays(1));
                }
                catch (ArcaException) { lista = null; }
                if (lista is not { Count: > 0 }) lista = CondicionesIvaArca.ClaseC.ToList();
            }
            return Ok(lista!.Select(c => new { id = c.Id, nombre = c.Nombre }));
        }

        // =====================================================================
        // Clientes
        // =====================================================================

        // GET api/facturacion/clientes?q=
        [HttpGet("clientes")]
        public async Task<ActionResult<object>> GetClientes([FromQuery] string? q)
        {
            var query = _db.Clientes.AsQueryable();
            if (!string.IsNullOrWhiteSpace(q))
            {
                var texto = q.Trim();
                var digitos = Documentos.SoloDigitos(texto);
                query = query.Where(c => c.Nombre.Contains(texto) || (digitos.Length > 0 && c.DocNro.Contains(digitos)));
            }
            var lista = await query.OrderBy(c => c.Nombre).Take(200).ToListAsync();
            return Ok(lista.Select(DtoCliente));
        }

        // POST api/facturacion/clientes
        [HttpPost("clientes")]
        public async Task<ActionResult<object>> PostCliente([FromBody] ClienteRequest req)
        {
            var (cliente, error) = await GuardarClienteAsync(new Cliente { Creado = Hora.Ahora() }, req);
            if (error != null) return Error(error);
            return Ok(DtoCliente(cliente!));
        }

        // PUT api/facturacion/clientes/5
        [HttpPut("clientes/{id}")]
        [Authorize(Roles = Roles.Gestion)]
        public async Task<ActionResult<object>> PutCliente(int id, [FromBody] ClienteRequest req)
        {
            var cliente = await _db.Clientes.FindAsync(id);
            if (cliente == null) return NotFound();
            var (guardado, error) = await GuardarClienteAsync(cliente, req);
            if (error != null) return Error(error);
            return Ok(DtoCliente(guardado!));
        }

        // DELETE api/facturacion/clientes/5  (las facturas ya emitidas conservan sus datos)
        [HttpDelete("clientes/{id}")]
        [Authorize(Roles = Roles.Gestion)]
        public async Task<IActionResult> DeleteCliente(int id)
        {
            var cliente = await _db.Clientes.FindAsync(id);
            if (cliente == null) return NotFound();
            _db.Clientes.Remove(cliente);
            await _db.SaveChangesAsync();
            return NoContent();
        }

        private async Task<(Cliente?, string?)> GuardarClienteAsync(Cliente cliente, ClienteRequest req)
        {
            var error = ValidarCliente(req);
            if (error != null) return (null, error);
            var nro = Documentos.SoloDigitos(req.DocNro);

            var duplicado = await _db.Clientes.AnyAsync(c => c.Id != cliente.Id && c.DocTipo == req.DocTipo && c.DocNro == nro);
            if (duplicado) return (null, $"Ya hay un cliente guardado con ese {TiposDocumento.Nombre(req.DocTipo)}.");

            cliente.Nombre = req.Nombre.Trim();
            cliente.DocTipo = req.DocTipo;
            cliente.DocNro = nro;
            cliente.CondicionIvaId = req.CondicionIvaId;
            cliente.Domicilio = string.IsNullOrWhiteSpace(req.Domicilio) ? null : req.Domicilio.Trim();
            cliente.Telefono = string.IsNullOrWhiteSpace(req.Telefono) ? null : req.Telefono.Trim();
            if (cliente.Id == 0) _db.Clientes.Add(cliente);
            await _db.SaveChangesAsync();
            return (cliente, null);
        }

        private static string? ValidarCliente(ClienteRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.Nombre)) return "Ingrese el nombre o razón social.";
            var error = Documentos.Validar(req.DocTipo, req.DocNro);
            if (error != null) return error;
            if (!CondicionesIvaArca.ClaseC.Any(c => c.Id == req.CondicionIvaId))
                return "Condición frente al IVA inválida.";
            return null;
        }

        private static object DtoCliente(Cliente c) => new
        {
            c.Id,
            c.Nombre,
            c.DocTipo,
            docTipoNombre = TiposDocumento.Nombre(c.DocTipo),
            c.DocNro,
            c.CondicionIvaId,
            condicionIva = CondicionesIvaArca.Nombre(c.CondicionIvaId),
            c.Domicilio,
            c.Telefono,
        };

        // =====================================================================
        // Facturas
        // =====================================================================

        // POST api/facturacion/ventas/5/facturar
        [HttpPost("ventas/{ventaId}/facturar")]
        public async Task<ActionResult<object>> Facturar(int ventaId, [FromBody] FacturarRequest req, CancellationToken ct)
        {
            var venta = await _db.Ventas.FirstOrDefaultAsync(v => v.Id == ventaId, ct);
            if (venta == null) return NotFound();
            if (!Roles.EsGestion(User.Rol()) && venta.Usuario != User.Email()) return Forbid();

            Receptor receptor;
            if (req.ClienteId != null)
            {
                var c = await _db.Clientes.FindAsync(new object[] { req.ClienteId.Value }, ct);
                if (c == null) return Error("El cliente no existe.");
                receptor = new Receptor(c.Id, c.Nombre, c.DocTipo, long.Parse(c.DocNro), c.CondicionIvaId, c.Domicilio, c.Telefono);
            }
            else if (req.Cliente != null)
            {
                var error = ValidarCliente(req.Cliente);
                if (error != null) return Error(error);
                var nro = Documentos.SoloDigitos(req.Cliente.DocNro);
                int? clienteId = null;
                if (req.Guardar)
                {
                    var existente = await _db.Clientes.FirstOrDefaultAsync(c => c.DocTipo == req.Cliente.DocTipo && c.DocNro == nro, ct);
                    var (guardado, errorGuardar) = await GuardarClienteAsync(existente ?? new Cliente { Creado = Hora.Ahora() }, req.Cliente);
                    if (errorGuardar != null) return Error(errorGuardar);
                    clienteId = guardado!.Id;
                }
                receptor = new Receptor(clienteId, req.Cliente.Nombre, req.Cliente.DocTipo, long.Parse(nro),
                    req.Cliente.CondicionIvaId, req.Cliente.Domicilio, req.Cliente.Telefono);
            }
            else
            {
                receptor = Receptor.ConsumidorFinal();
            }

            try
            {
                var factura = await _facturacion.FacturarVentaAsync(venta, receptor, User.Email(), ct);
                return Ok(await _facturacion.ComprobanteAsync(factura, ct));
            }
            catch (ArcaException ex)
            {
                return Error(ex.Message);
            }
        }

        // GET api/facturacion/facturas?desde=&hasta=&ventaId=
        [HttpGet("facturas")]
        public async Task<ActionResult<object>> GetFacturas(
            [FromQuery] DateTime? desde, [FromQuery] DateTime? hasta, [FromQuery] int? ventaId, CancellationToken ct)
        {
            var query = _db.Facturas.Where(f => f.Entorno == _arca.Entorno);
            if (ventaId.HasValue) query = query.Where(f => f.VentaId == ventaId.Value);
            if (desde.HasValue) query = query.Where(f => f.Fecha >= desde.Value.Date);
            if (hasta.HasValue) query = query.Where(f => f.Fecha < hasta.Value.Date.AddDays(1));

            // Un vendedor sólo ve las facturas de sus ventas
            if (!Roles.EsGestion(User.Rol()))
            {
                var email = User.Email();
                query = query.Where(f => f.Venta!.Usuario == email);
            }

            var lista = await query.OrderByDescending(f => f.Fecha).ThenByDescending(f => f.Numero).Take(500).ToListAsync(ct);
            var neto = lista.Sum(f => f.Tipo == TiposComprobante.NotaCreditoC ? -f.Total : f.Total);

            return Ok(new
            {
                entorno = _arca.Entorno,
                cantidad = lista.Count,
                neto,
                data = lista.Select(f => new
                {
                    f.Id,
                    f.Tipo,
                    tipoNombre = TiposComprobante.Nombre(f.Tipo),
                    numeroFormateado = FacturacionService.NumeroFormateado(f.PuntoVenta, f.Numero),
                    f.Fecha,
                    f.VentaId,
                    receptorNombre = f.ReceptorNombre ?? (f.ReceptorDocTipo == TiposDocumento.SinIdentificar ? "Consumidor Final" : null),
                    receptorDoc = f.ReceptorDocTipo == TiposDocumento.SinIdentificar ? null
                        : $"{TiposDocumento.Nombre(f.ReceptorDocTipo)} {f.ReceptorDocNro}",
                    f.Total,
                    f.Cae,
                    f.Estado,
                    f.AsociadaId,
                    esPrueba = f.Entorno != EntornosArca.Produccion,
                }),
            });
        }

        // GET api/facturacion/facturas/5
        [HttpGet("facturas/{id}")]
        public async Task<ActionResult<object>> GetFactura(int id, CancellationToken ct)
        {
            var f = await _db.Facturas.Include(x => x.Venta).FirstOrDefaultAsync(x => x.Id == id, ct);
            if (f == null) return NotFound();
            if (!Roles.EsGestion(User.Rol()) && f.Venta?.Usuario != User.Email()) return Forbid();
            return Ok(await _facturacion.ComprobanteAsync(f, ct));
        }

        // POST api/facturacion/facturas/5/anular  -> Nota de crédito C por el total
        [HttpPost("facturas/{id}/anular")]
        [Authorize(Roles = Roles.Gestion)]
        public async Task<ActionResult<object>> Anular(int id, CancellationToken ct)
        {
            var f = await _db.Facturas.FirstOrDefaultAsync(x => x.Id == id, ct);
            if (f == null) return NotFound();
            try
            {
                var nota = await _facturacion.AnularAsync(f, User.Email(), ct);
                return Ok(await _facturacion.ComprobanteAsync(nota, ct));
            }
            catch (ArcaException ex)
            {
                return Error(ex.Message);
            }
        }
    }
}
