using Microsoft.EntityFrameworkCore;
using ProizvodiApi.Models;

namespace ProizvodiApi.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        public DbSet<Proizvod> Proizvodi { get; set; }
    }
}
