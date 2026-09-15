using Backend.Models;
using Backend.Services;
using Backend.Services.Email;
using Microsoft.AspNetCore.Localization;
using Microsoft.Extensions.Options;
using System.Globalization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using System.Text;
using Backend.Models.Dto;
using Backend;
using System.Security.Claims;


if (args.Contains("--seed-demo", StringComparer.Ordinal))
{
    Environment.ExitCode = await Backend.LocalDevelopment.DemoSeeder.RunAsync(args);
    return;
}

var builder = WebApplication.CreateBuilder(args);


// Add services to the container.
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll",
        builder => builder.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader());
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddControllers();
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Baza")));

// Registracija Service-a
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<IOrganizerService, OrganizerService>();
builder.Services.AddScoped<IEventService, EventService>();
builder.Services.AddScoped<IPasswordResetService, PasswordResetService>();

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,

        ValidIssuer = builder.Configuration["Jwt:Issuer"],
        ValidAudience = builder.Configuration["Jwt:Audience"],
        IssuerSigningKey = new SymmetricSecurityKey(
                                                Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"])),
        NameClaimType = ClaimTypes.NameIdentifier,
        RoleClaimType = ClaimTypes.Role
    };
});
builder.Services.AddSwaggerGen(c =>
{
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme.\n\n" +
                      "Enter your token in the text box below prefixed with \"Bearer \".\n\n" +
                      "Example: \"Bearer abcdef12345\"",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.Http,
        Scheme = "Bearer",
        BearerFormat = "JWT"
    });

    c.AddSecurityRequirement(new OpenApiSecurityRequirement {
        {
            new OpenApiSecurityScheme {
                Reference = new OpenApiReference {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            new string[] {}
        }
    });

    // vital line:
    c.MapType<IFormFile>(() => new Microsoft.OpenApi.Models.OpenApiSchema
    {
        Type = "string",
        Format = "binary"
    });
});

builder.Services.AddAuthorization();

builder.Services.AddHostedService<EventLifecycleHostedService>();


builder.WebHost.UseUrls("http://0.0.0.0:11061");

builder.Services.AddScoped<IEmailVerificationService, EmailVerificationService>();
builder.Services.AddEmail(builder.Configuration);

// Localization services
builder.Services.AddLocalization(options => options.ResourcesPath = "Resources");

var supportedCultures = new[] { "en", "sr" }
    .Select(c => new CultureInfo(c))
    .ToList();

builder.Services.Configure<RequestLocalizationOptions>(options =>
{
    
    options.DefaultRequestCulture = new RequestCulture("en");
    options.SupportedCultures = supportedCultures;
    options.SupportedUICultures = supportedCultures;

    // Rely on Accept-Language (web) and default for others; no query or user.language
    options.RequestCultureProviders = new IRequestCultureProvider[]
    {
        new AcceptLanguageHeaderRequestCultureProvider()
    };
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    var dbContext = services.GetRequiredService<AppDbContext>();
    dbContext.Database.Migrate();
}

// Order matters: UseStaticFiles must be before UseRouting
app.UseDefaultFiles();
var provider = new FileExtensionContentTypeProvider();
provider.Mappings[".apk"] = "application/vnd.android.package-archive";


var allowedReferers = new[]
{
    "http://localhost:4200"
};

app.UseWhen(ctx => ctx.Request.Path.StartsWithSegments("/images"), branch =>
{
    branch.Use(async (context, next) =>
    {
        var referer = context.Request.Headers["Referer"].ToString();
        var isAllowed = !string.IsNullOrEmpty(referer) &&
                        allowedReferers.Any(origin => referer.StartsWith(origin, StringComparison.OrdinalIgnoreCase));

        if (!app.Environment.IsDevelopment() && !isAllowed)
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            await context.Response.WriteAsync("Forbidden");
            return;
        }

        await next();
    });

    branch.UseStaticFiles(new StaticFileOptions
    {
        RequestPath = "/images",
        FileProvider = new PhysicalFileProvider(Path.Combine(app.Environment.WebRootPath, "images"))
    });
});


app.UseStaticFiles(new StaticFileOptions
{
    ContentTypeProvider = provider
});

// Configure the HTTP request pipeline.



//app.UseHttpsRedirection();

app.UseCors("AllowAll");

app.UseAuthentication();

app.UseAuthorization();

// Enable request localization middleware
app.UseRequestLocalization(app.Services.GetRequiredService<IOptions<RequestLocalizationOptions>>().Value);

// Global exception handler returning localized generic message
app.UseExceptionHandler(handlerApp =>
{
    handlerApp.Run(async context =>
    {
        var localizer = context.RequestServices.GetRequiredService<Microsoft.Extensions.Localization.IStringLocalizer<SharedResource>>();
        context.Response.StatusCode = StatusCodes.Status500InternalServerError;
        context.Response.ContentType = "application/json";
        var msg = localizer["common.unexpected_error"].ToString();
        await context.Response.WriteAsJsonAsync(new { message = msg });
    });
});

app.MapPost("/auth/send-verification", async (
    IEmailVerificationService svc,
    AppDbContext db,
    HttpContext http,
    CancellationToken ct
) =>
{
    // if you have JWT userId claim:
    var userIdStr = http.User.Claims.FirstOrDefault(c => c.Type == "sub" || c.Type == "userId")?.Value;
    if (string.IsNullOrEmpty(userIdStr)) return Results.Unauthorized();

    if (!int.TryParse(userIdStr, out var userId)) return Results.Unauthorized();

    var user = await db.Users.FindAsync([userId], ct);
    if (user is null) return Results.NotFound();

    // Optional: return 200 even if already verified (idempotent)
    if (user.IsEmailVerified) return Results.Ok(new { sent = false, alreadyVerified = true });

    await svc.SendVerificationAsync(user, ct);
    return Results.Ok(new { sent = true });
}).RequireAuthorization();

app.MapGet("/auth/verify-email", async (
    string token,
    IEmailVerificationService svc,
    IConfiguration cfg,
    CancellationToken ct
) =>
{
    var ok = Guid.TryParse(token, out var tokenId);
    var successUrl = cfg["Auth:EmailVerification:RedirectUrlOnSuccess"] ?? "/";
    var failUrl = cfg["Auth:EmailVerification:RedirectUrlOnFail"] ?? "/";

    if (!ok) return Results.Redirect(failUrl);

    var (verified, _) = await svc.VerifyAsync(tokenId, ct);
    return Results.Redirect(verified ? successUrl : failUrl);
});


app.MapPost("/auth/forgot-password", async (
    IPasswordResetService svc,
    ForgotPasswordDto body,
    CancellationToken ct) =>
{
    await svc.RequestAsync(body.Email, ct);
    return Results.Ok(new { sent = true });
});



app.MapPost("/auth/reset-password", async (
    IPasswordResetService svc,
    ResetPasswordDto body,
    CancellationToken ct) =>
{
    if (!Guid.TryParse(body.Token, out var tokenId))
        return Results.BadRequest(new { ok = false, message = "Invalid token format." });

    var (ok, msg) = await svc.ResetAsync(tokenId, body.NewPassword, ct);
    return ok ? Results.Ok(new { ok = true }) : Results.BadRequest(new { ok = false, message = msg });
});
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.MapControllers();
app.MapFallbackToFile("index.html");

app.Run();



