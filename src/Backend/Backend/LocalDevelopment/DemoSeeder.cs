using System.Globalization;
using System.Net;
using Backend.Helpers;
using Backend.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Npgsql;

namespace Backend.LocalDevelopment;

/// <summary>Explicit, one-time Development fixtures for an empty local database.</summary>
public static class DemoSeeder
{
    private static readonly string[] ApplicationTables =
    [
        "Users", "Organizers", "Suppliers", "Events", "EventActivities", "EventPin",
        "Tickets", "UserTickets", "Resources", "EventResources", "FavoriteEvents",
        "UserResourceReservations", "EmailVerificationTokens", "ResourceLog"
    ];

    public static async Task<int> RunAsync(string[] args)
    {
        try
        {
            var (environment, date) = ParseArguments(args);
            // Build configuration only. Never build/start the host or register application services.
            var builder = WebApplication.CreateBuilder(new WebApplicationOptions
            {
                Args = [], EnvironmentName = environment
            });
            Require(builder.Environment.IsDevelopment(), "Seeding requires Development environment.");

            var privateConfiguration = new ConfigurationBuilder()
                .AddUserSecrets(typeof(DemoSeeder).Assembly, optional: true)
                .AddEnvironmentVariables()
                .Build();
            var password = privateConfiguration["LocalDemo:Password"];
            Require(password is not null && CommonHelpers.IsPasswordStrong(password),
                "Set a strong LocalDemo:Password in user secrets or the process environment.");

            var connection = new NpgsqlConnectionStringBuilder(
                builder.Configuration.GetConnectionString("Baza"));
            Require(connection.Database == "syncup_local", "The target database must be syncup_local.");
            var host = connection.Host?.Trim() ?? "";
            Require(host.Equals("localhost", StringComparison.OrdinalIgnoreCase)
                || (IPAddress.TryParse(host, out var address) && IPAddress.IsLoopback(address)),
                "The PostgreSQL host must be a single loopback address or localhost.");

            var now = DateTime.UtcNow;
            var seedDate = date ?? now.Date;
            Require(seedDate.AddDays(7).AddHours(16) > now,
                "The seed date would create an event that is not in the future.");
            var historyDate = seedDate < now.Date ? seedDate : now.Date;
            var webRoot = builder.Environment.WebRootPath
                ?? Path.Combine(builder.Environment.ContentRootPath, "wwwroot");
            foreach (var asset in new[] { "images/default-image.png", "images/default-pfp.png" }
                .Concat(Enumerable.Range(0, 12).Select(i => $"pins/{i}.png")))
                Require(File.Exists(Path.Combine(webRoot, asset)), "A required tracked image asset is missing.");

            // No logger factory or sensitive-data logging is attached to this context.
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseNpgsql(connection.ConnectionString).Options;
            await using var db = new AppDbContext(options);
            var expected = db.Database.GetMigrations().Order().ToArray();
            var applied = (await db.Database.GetAppliedMigrationsAsync()).Order().ToArray();
            Require(expected.Length == 27 && expected.SequenceEqual(applied)
                && !(await db.Database.GetPendingMigrationsAsync()).Any()
                && !db.Database.HasPendingModelChanges(),
                "The database must have exactly the current 27 migrations and no pending model changes.");

            await using var transaction = await db.Database.BeginTransactionAsync();
            // Serialize seed attempts and prevent application writes between emptiness checks and insertion.
            var tableNames = string.Join(", ", ApplicationTables.Select(t => $"\"public\".\"{t}\""));
            await ExecuteAsync(db, $"LOCK TABLE {tableNames} IN SHARE ROW EXCLUSIVE MODE NOWAIT");
            foreach (var table in ApplicationTables)
                Require(await CountAsync(db, table) == 0,
                    "Application tables must all be empty. Existing data will not be overwritten.");

            // Raw lookup reads avoid materializing the dormant UserRoles.RoleName enum mismatch.
            await ValidateLookupAsync(db, "UserRoles", "RoleId", "RoleName",
                Enum.GetValues<UserRole>().ToDictionary(x => (int)x, x => x.ToString()));
            await ValidateLookupAsync(db, "EventCategories", "CategoryID", "CategoryName",
                Enum.GetValues<EventCategory>().ToDictionary(x => (int)x, x => x.ToString()));
            await ValidateLookupAsync(db, "PinTypes", "PinTypeId", "PinCategory",
                Enum.GetValues<PinTypes>().ToDictionary(x => (int)x + 1, x => x.ToString()));

            var hash = CommonHelpers.HashPassword(password!);
            User MakeUser(string username, string firstName, string lastName, UserRole role) => new()
            {
                Username = username, Email = $"{username}@example.test", Password = hash,
                FirstName = firstName, LastName = lastName, Role = role,
                IsActive = true, IsEmailVerified = true, Language = "sr",
                PhoneNumber = "+381600000000", ProfilePicture = "images/default-pfp.png",
                CreationTime = historyDate.AddDays(-7), LastLoginTime = null,
                Credit = role == UserRole.MobileUser ? 10000m : 0m
            };
            var mobile = MakeUser("demo.mobile", "Demo", "Korisnik", UserRole.MobileUser);
            var organizer = MakeUser("demo.organizer", "Demo", "Organizator", UserRole.Organizer);
            var supplier = MakeUser("demo.supplier", "Demo", "Dobavljac", UserRole.Supplier);
            db.Users.AddRange(mobile, organizer, supplier);
            await db.SaveChangesAsync();
            db.Organizers.Add(new Organizer
            {
                Id = organizer.UserId, Name = "SyncUp Demo Organizer", Username = organizer.Username,
                Email = organizer.Email, PhoneNumber = organizer.PhoneNumber, Image = organizer.ProfilePicture
            });
            db.Suppliers.Add(new Supplier
            {
                Id = supplier.UserId, Username = supplier.Username, CompanyName = "SyncUp Demo Supplies",
                Email = supplier.Email, PhoneNumber = supplier.PhoneNumber, Website = "",
                CompanyBio = "Fictional local demonstration supplier.", Image = supplier.ProfilePicture
            });

            var specs = new[]
            {
                ("Campus Music Night", EventCategory.Music, "Kragujevac", 7, false, 44.0128, 20.9114),
                ("Community Sports Day", EventCategory.Sports, "Kragujevac", 10, true, 44.0140, 20.9100),
                ("Indie Games Meetup", EventCategory.Entertainment, "Belgrade", 14, false, 44.8176, 20.4633),
                ("Charity Community Fair", EventCategory.Charity, "Niš", 18, true, 43.3209, 21.8958),
                ("Student Career Forum", EventCategory.Business, "Belgrade", 21, true, 44.8176, 20.4633),
                ("Museum Evening", EventCategory.Culture, "Novi Sad", 28, false, 45.2551, 19.8452),
                ("Open Air Concert", EventCategory.Music, "Novi Sad", 35, false, 45.2551, 19.8452)
            };
            var roots = specs.Select(s => new Event
            {
                Title = s.Item1, Category = s.Item2, Location = s.Item3,
                Description = $"Fictional diploma demo: {s.Item1} in {s.Item3}. Explore the agenda and venue facilities.",
                StartDate = seedDate.AddDays(s.Item4).AddHours(16),
                EndDate = seedDate.AddDays(s.Item4).AddHours(22),
                Organizer = organizer, NumberOfPeople = 100, ImageUrl = "images/default-image.png",
                isFree = s.Item5, Status = EventStatus.Published,
                PublishedAt = historyDate.AddDays(-4), ParentEventId = 0
            }).ToArray();
            db.Events.AddRange(roots);
            await db.SaveChangesAsync();
            var child = new Event
            {
                Title = "Acoustic Session", Category = EventCategory.Music, Location = roots[0].Location,
                Description = "A fictional acoustic performance within Campus Music Night.",
                StartDate = roots[0].StartDate.AddHours(2), EndDate = roots[0].StartDate.AddHours(3),
                Organizer = organizer, NumberOfPeople = 50, ImageUrl = "images/default-image.png",
                isFree = true, Status = EventStatus.Published, PublishedAt = historyDate.AddDays(-4),
                ParentEventId = roots[0].EventID
            };
            db.Events.Add(child);
            await db.SaveChangesAsync();

            foreach (var e in roots.Append(child))
            {
                db.EventActivities.Add(new EventActivity
                {
                    Event = e, Title = "Welcome and introduction", Category = e.Category,
                    Description = "Meet the hosts and learn about the demo programme.",
                    StartTime = e.StartDate, EndTime = e.StartDate.AddMinutes(30)
                });
                if (e != child)
                    db.EventActivities.Add(new EventActivity
                    {
                        Event = e, Title = "Main programme", Category = e.Category,
                        Description = $"Main programme for {e.Title}.",
                        StartTime = e.StartDate.AddHours(1), EndTime = e.EndDate.AddHours(-1)
                    });
            }
            for (var i = 0; i < roots.Length; i++)
            {
                AddPin(roots[i], PinTypes.Entrance, "Main entrance", specs[i].Item6, specs[i].Item7);
                AddPin(roots[i], roots[i].Category == EventCategory.Music ? PinTypes.Stage : PinTypes.Info,
                    "Main programme area", specs[i].Item6 + 0.0003, specs[i].Item7 + 0.0003);
                AddPin(roots[i], PinTypes.FirstAid, "First-aid point", specs[i].Item6 - 0.0002, specs[i].Item7 + 0.0002);
            }
            AddPin(child, PinTypes.Stage, "Acoustic stage", specs[0].Item6 + 0.0004, specs[0].Item7);
            AddPin(child, PinTypes.Restroom, "Restrooms", specs[0].Item6 + 0.0002, specs[0].Item7 - 0.0002);
            void AddPin(Event e, PinTypes category, string label, double latitude, double longitude) =>
                db.EventPin.Add(new EventPin
                {
                    EventId = e.EventID, PinCategory = category, Label = label,
                    Description = "Illustrative demo venue location, not a verified real-world facility.",
                    Latitude = latitude, Longitude = longitude, PinnedAt = historyDate.AddDays(-4)
                });

            Ticket MakeTicket(Event e, string name, decimal price, int quota) => new()
            {
                Event = e, TypeName = name, Description = $"{name} admission to {e.Title}.",
                Price = price, Quota = quota, validFrom = historyDate.AddDays(-3), validUntil = e.EndDate
            };
            var tickets = new[]
            {
                MakeTicket(roots[0], "Limited pass", 600, 2), MakeTicket(roots[0], "Standard", 1000, 40),
                MakeTicket(roots[2], "Standard", 700, 30), MakeTicket(roots[2], "Premium", 1200, 10),
                MakeTicket(roots[5], "Standard", 400, 25), MakeTicket(roots[5], "Guided experience", 800, 10),
                MakeTicket(roots[6], "Standard", 900, 50), MakeTicket(roots[6], "Premium", 1500, 15)
            };
            db.Tickets.AddRange(tickets);
            var purchases = new[] { tickets[0], tickets[0], tickets[2], tickets[4] }
                .Select(t => new UserTicket
                {
                    User = mobile, Ticket = t, PurchasedAt = historyDate.AddDays(-2),
                    IsUsed = false, UsedAt = null, ValidationToken = CommonHelpers.GenerateValidationToken()
                }).ToArray();
            db.UserTickets.AddRange(purchases);

            Resource MakeResource(string name, ResourceCategory category, bool exhaustable = false) => new()
            {
                Name = name, Category = category, Description = $"Demo reservable {name.ToLowerInvariant()}.",
                SupplierID = supplier.UserId, Quantity = 100, IsAvailable = ResourceAvailability.Available,
                IsExhaustable = exhaustable
            };
            var resources = new[]
            {
                MakeResource("Folding chairs", ResourceCategory.Furniture),
                MakeResource("Tables", ResourceCategory.Furniture),
                MakeResource("Audio headsets", ResourceCategory.Technology),
                MakeResource("Sports equipment kits", ResourceCategory.Equipment),
                MakeResource("Reusable water bottles", ResourceCategory.FoodAndBeverage, true)
            };
            db.Resources.AddRange(resources);
            var allocationSpecs = new[] { (0, 0), (0, 4), (1, 3), (1, 4), (2, 1), (2, 2), (3, 1), (4, 0), (5, 2), (6, 0) };
            var allocations = allocationSpecs.Select(s => new EventResource
            {
                Event = roots[s.Item1], Resource = resources[s.Item2], Supplier = supplier,
                Quantity = 20, IsReservable = true, Status = EventResourceStatus.Approved,
                StartDateTimeBooked = roots[s.Item1].StartDate.AddHours(-1),
                EndDateTimeBooked = roots[s.Item1].EndDate.AddHours(1)
            }).ToArray();
            db.EventResources.AddRange(allocations);
            foreach (var e in new[] { roots[0], roots[3], roots[5] })
                db.FavoriteEvents.Add(new FavoriteEvent { UserId = mobile.UserId, EventId = e.EventID });
            await db.SaveChangesAsync();

            var reservations = new[]
            {
                MakeReservation(allocations[0], purchases[0]),
                MakeReservation(allocations[8], purchases[3]),
                MakeReservation(allocations[2], null)
            };
            UserResourceReservation MakeReservation(EventResource allocation, UserTicket? purchase) => new()
            {
                User = mobile, EventResource = allocation, UserTicketID = purchase?.UserTicketID,
                Quantity = 1, ReservedAt = historyDate.AddDays(-1)
            };
            db.UserResourceReservations.AddRange(reservations);
            await db.SaveChangesAsync();

            Require(roots.Append(child).All(e => e.StartDate > DateTime.UtcNow && e.EndDate > e.StartDate)
                && tickets.All(t => t.validUntil.Date > DateTime.UtcNow.Date)
                && tickets.All(t => purchases.Count(p => p.Ticket == t) <= t.Quota)
                && purchases.GroupBy(p => p.Ticket.Event).All(g => g.Count() <= 10)
                && allocations.All(a => reservations.Where(r => r.EventResource == a).Sum(r => r.Quantity) <= a.Quantity)
                && reservations.All(r => r.EventResource.Event.isFree ? r.UserTicketID is null
                    : purchases.Any(p => p.UserTicketID == r.UserTicketID && p.User == r.User
                        && p.Ticket.Event == r.EventResource.Event)),
                "Fixture business-constraint validation failed.");
            var counts = new[] { 3, 1, 1, 8, 15, 23, 8, 4, 5, 10, 3, 3, 0, 0 };
            for (var i = 0; i < ApplicationTables.Length; i++)
                Require(await CountAsync(db, ApplicationTables[i]) == counts[i], "Fixture row-count validation failed.");
            await transaction.CommitAsync();
            Console.WriteLine($"Demo seed committed to syncup_local. Seed date: {seedDate:yyyy-MM-dd}. Application rows: 84.");
            for (var i = 0; i < ApplicationTables.Length; i++)
                Console.WriteLine($"{ApplicationTables[i]}: {counts[i]}");
            return 0;
        }
        catch (SeedRefusedException exception)
        {
            Console.Error.WriteLine(exception.Message);
            return 1;
        }
        catch
        {
            // Provider/configuration exceptions can contain credentials or sensitive row values.
            Console.Error.WriteLine("Demo seeding failed. No partial seed transaction is retained. Check local configuration, schema and database availability privately.");
            return 1;
        }
    }

    private static (string? Environment, DateTime? Date) ParseArguments(string[] args)
    {
        Require(args.Count(a => a == "--seed-demo") == 1, "Supply --seed-demo exactly once.");
        string? environment = null;
        DateTime? date = null;
        for (var i = 0; i < args.Length; i++)
        {
            if (args[i] == "--seed-demo") continue;
            // Whitelist only nonsecret options; never send CLI values to private configuration.
            Require(args[i] is "--environment" or "--seed-date", "Only --seed-demo, --environment and --seed-date are accepted. Password CLI arguments are forbidden.");
            var option = args[i];
            Require(++i < args.Length, "A seed command option is missing its value.");
            if (option == "--environment")
            {
                Require(environment is null, "Supply --environment at most once.");
                environment = args[i];
            }
            else
            {
                Require(date is null, "Supply --seed-date at most once.");
                Require(DateTime.TryParseExact(args[i], "yyyy-MM-dd", CultureInfo.InvariantCulture,
                    DateTimeStyles.None, out var parsed), "Seed date must use YYYY-MM-DD format.");
                date = DateTime.SpecifyKind(parsed, DateTimeKind.Utc);
            }
        }
        return (environment, date);
    }

    private static NpgsqlCommand Command(AppDbContext db, string sql) => new(sql,
        (NpgsqlConnection)db.Database.GetDbConnection(),
        (NpgsqlTransaction)db.Database.CurrentTransaction!.GetDbTransaction());

    private static async Task ExecuteAsync(AppDbContext db, string sql)
    {
        await using var command = Command(db, sql);
        await command.ExecuteNonQueryAsync();
    }

    private static async Task<long> CountAsync(AppDbContext db, string table)
    {
        // Table identifiers are exclusively supplied by the fixed internal whitelist above.
        await using var command = Command(db, $"SELECT count(*) FROM \"public\".\"{table}\"");
        return (long)(await command.ExecuteScalarAsync())!;
    }

    private static async Task ValidateLookupAsync(AppDbContext db, string table, string id, string name,
        Dictionary<int, string> expected)
    {
        await using var command = Command(db, $"SELECT \"{id}\", \"{name}\" FROM \"public\".\"{table}\"");
        await using var reader = await command.ExecuteReaderAsync();
        var count = 0;
        while (await reader.ReadAsync())
        {
            Require(expected.TryGetValue(reader.GetInt32(0), out var value) && reader.GetString(1) == value,
                "Migration-provided lookup data does not match the expected values.");
            count++;
        }
        Require(count == expected.Count, "Migration-provided lookup data has an unexpected row count.");
    }

    private static void Require(bool condition, string message)
    {
        if (!condition) throw new SeedRefusedException(message);
    }

    private sealed class SeedRefusedException(string message) : Exception(message);
}
