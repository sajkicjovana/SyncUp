using ProizvodiApi.Data;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
        policy.WithOrigins(
            "http://localhost:4200",
            "http://192.168.235.32:5222"
            )
            .AllowAnyHeader()
            .AllowAnyMethod());
});


builder.Services.AddControllers();

builder.Services.AddOpenApi();

builder.WebHost.UseUrls("http://0.0.0.0:5222");

var app = builder.Build();  

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors("AllowAll");

//app.UseHttpsRedirection();

app.MapControllers();

app.Run();
