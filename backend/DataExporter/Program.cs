using System;
using System.IO;
using System.Text;
using System.Data;
using Microsoft.Data.SqlClient;

class Program
{
    static void Main()
    {
        string connectionString = "Server=(localdb)\\mssqllocaldb;Database=JoyeriasStockDb;Trusted_Connection=True;MultipleActiveResultSets=true";
        string outputPath = @"D:\app carga de stock\database\Productos_Insert_Export.sql";

        StringBuilder sb = new StringBuilder();

        using (SqlConnection conn = new SqlConnection(connectionString))
        {
            conn.Open();
            Console.WriteLine("Conectado a la BD local.");

            // 1. Exportar Productos (Tabla 'Producto')
            ExportTable(conn, "Producto", sb, true);

            // 2. Exportar Usuarios
            ExportTable(conn, "Usuarios", sb, true);

            // 3. Exportar Egresos
            ExportTable(conn, "Egresos", sb, true);
        }

        File.WriteAllText(outputPath, sb.ToString(), Encoding.UTF8);
        Console.WriteLine($"Exportación completada. Archivo generado en: {outputPath}");
    }

    static void ExportTable(SqlConnection conn, string tableName, StringBuilder sb, bool withIdentityInsert)
    {
        string sqlQuery = $"SELECT * FROM [{tableName}]";
        int count = 0;

        try
        {
            using (SqlCommand cmd = new SqlCommand(sqlQuery, conn))
            using (SqlDataReader reader = cmd.ExecuteReader())
            {
                if (!reader.HasRows) return;

                sb.AppendLine($"-- EXPORTANDO TABLA {tableName}");
                if (withIdentityInsert)
                {
                    sb.AppendLine($"SET IDENTITY_INSERT [{tableName}] ON;");
                    sb.AppendLine("GO");
                }

                while (reader.Read())
                {
                    count++;
                    StringBuilder cols = new StringBuilder();
                    StringBuilder vals = new StringBuilder();

                    for (int i = 0; i < reader.FieldCount; i++)
                    {
                        cols.Append($"[{reader.GetName(i)}]");
                        vals.Append(EscapeSql(reader.GetValue(i)));

                        if (i < reader.FieldCount - 1)
                        {
                            cols.Append(", ");
                            vals.Append(", ");
                        }
                    }

                    sb.AppendLine($"INSERT INTO [{tableName}] ({cols.ToString()}) VALUES ({vals.ToString()});");
                }

                if (withIdentityInsert)
                {
                    sb.AppendLine($"SET IDENTITY_INSERT [{tableName}] OFF;");
                    sb.AppendLine("GO");
                }
                sb.AppendLine();
                Console.WriteLine($"Se exportaron {count} filas de la tabla {tableName}.");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error al exportar tabla {tableName}: {ex.Message}");
        }
    }

    static string EscapeSql(object value)
    {
        if (value == DBNull.Value || value == null) return "NULL";

        if (value is bool b) return b ? "1" : "0";
        if (value is DateTime dt) return $"CAST('{dt:yyyy-MM-dd HH:mm:ss.fff}' AS DATETIME2)";
        if (value is decimal || value is float || value is double) return value.ToString().Replace(",", ".");
        if (value is int || value is long || value is short || value is byte) return value.ToString();

        return "N'" + value.ToString().Replace("'", "''") + "'";
    }
}
