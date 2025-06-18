using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProizvodiApi.Data;
using ProizvodiApi.Models;

namespace ProizvodiApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ProizvodiController : ControllerBase
    {
        private readonly AppDbContext _context;

        public ProizvodiController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Proizvod>>> Get()
        {
            return await _context.Proizvodi.ToListAsync();
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<Proizvod>> Get(int id)
        {
            var proizvod = await _context.Proizvodi.FindAsync(id);
            if (proizvod == null)
                return NotFound();
            return proizvod;
        }

        [HttpPost]
        public async Task<ActionResult<Proizvod>> Post(Proizvod proizvod)
        {
            _context.Proizvodi.Add(proizvod);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(Get), new { id = proizvod.Id }, proizvod);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Put(int id, Proizvod proizvod)
        {
            if (id != proizvod.Id)
                return BadRequest();

            _context.Entry(proizvod).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!_context.Proizvodi.Any(e => e.Id == id))
                    return NotFound();
                else
                    throw;
            }

            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var proizvod = await _context.Proizvodi.FindAsync(id);
            if (proizvod == null)
                return NotFound();

            _context.Proizvodi.Remove(proizvod);
            await _context.SaveChangesAsync();

            return NoContent();
        }
    }
}
