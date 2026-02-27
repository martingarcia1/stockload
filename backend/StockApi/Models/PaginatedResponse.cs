namespace StockApi.Models
{
    public class PaginatedResponse<T>
    {
        public IEnumerable<T> Data { get; set; } = new List<T>();
        public int TotalItems { get; set; }
        public int TotalPages { get; set; }
        public int CurrentPage { get; set; }
        public int PageSize { get; set; }

        public PaginatedResponse(IEnumerable<T> data, int count, int pageNumber, int pageSize)
        {
            Data = data;
            TotalItems = count;
            CurrentPage = pageNumber;
            PageSize = pageSize;
            TotalPages = (int)Math.Ceiling(count / (double)pageSize);
        }
    }
}
