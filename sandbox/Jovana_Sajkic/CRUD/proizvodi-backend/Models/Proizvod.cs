namespace ProizvodiApi.Models
{
    public class Proizvod
    {
        public int Id { get; set; }
        public string Naziv { get; set; } = string.Empty;
        public decimal Cena { get; set; }
    }
}
