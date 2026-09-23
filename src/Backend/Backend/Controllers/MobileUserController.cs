using Backend.Helpers;
using Backend.Models;
using Backend.Models.Dto;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using System.Text.RegularExpressions;

namespace Backend.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = "MobileUser")]
    public class MobileUserController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IWebHostEnvironment _env;
        private readonly IStringLocalizer<SharedResource> _localizer;

        public MobileUserController(AppDbContext context, IWebHostEnvironment env, IStringLocalizer<SharedResource> localizer)
        {
            _context = context;
            _env = env;
            _localizer = localizer;
        }


        [HttpGet("reservations")]
        public async Task<IActionResult> GetUserReservations()
        {
            var userId = int.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier).Value);

            var reservations = await _context.UserResourceReservations
                .Where(r => r.UserID == userId)
                .Select(r => new {
                    r.Id,
                    r.EventResourceID,
                    r.Quantity,
                    r.ReservedAt,
                    ResourceName = r.EventResource.Resource.Name,
                    EventName = r.EventResource.Event.Title
                })
                .ToListAsync();

            return Ok(reservations);
        }

        
        [HttpGet("profile")]
        public async Task<IActionResult> GetProfile()
        {
            var userId = int.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier).Value);

            var user =await _context.Users.FirstOrDefaultAsync(u => u.UserId == userId);
            if (user == null)
                return NotFound(_localizer["user.not_found"].ToString());

           return Ok(new {
                email = user.Email,
                firstName = user.FirstName,
                lastName = user.LastName,
                phoneNumber = user.PhoneNumber,
                profilePicture = user.ProfilePicture 
            });

        }

        
        [Authorize]
        [HttpPut("profileUpdate")]
        public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileDto dto)
        {
            var userId = int.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier).Value);
            var user = await _context.Users.FirstOrDefaultAsync(u => u.UserId == userId);
            if (user == null)
                return NotFound(new { message = _localizer["user.not_found"].ToString() });

            if (_context.Users.Any(u => u.Email == dto.Email && u.UserId != userId))
                return BadRequest(new { message = _localizer["common.email_exists"].ToString() });

            if (string.IsNullOrWhiteSpace(dto.Email) || !CommonHelpers.IsEmailInValidForm(dto.Email))
                return BadRequest(new { message = _localizer["common.invalid_email"].ToString() });

            if (!string.IsNullOrWhiteSpace(dto.PhoneNumber) && !CommonHelpers.IsPhoneNumberValid(dto.PhoneNumber))
                return BadRequest(new { message = _localizer["common.invalid_phone"].ToString() });

            user.FirstName = dto.FirstName;
            user.LastName = dto.LastName;
            user.Email = dto.Email;
            user.PhoneNumber = dto.PhoneNumber;
            
            await _context.SaveChangesAsync();
            return Ok(new { message = _localizer["organizer.updated"].ToString() });
        }

        [HttpGet("event/{eventId}")]
        public async Task<IActionResult> GetPinsForPublishedEvent(int eventId)
        {
            try
            {
                
                var eventExists = await _context.Events
                    .AnyAsync(e => e.EventID == eventId && e.Status==EventStatus.Published);

                if (!eventExists)
                {
                    return NotFound(new { message = _localizer["events.not_found"].ToString() });
                }

                var pins = await _context.EventPin
                    .Where(p => p.EventId == eventId)
                    .ToListAsync();

                
                var pinDtos = pins.Select(p => new EventPinDto
                {
                    Id = p.Id,
                    EventId = p.EventId,
                    Latitude = p.Latitude,
                    Longitude = p.Longitude,
                    Label = p.Label,
                    Description = p.Description,
                    PinnedAt = p.PinnedAt,
                    PinCategory = p.PinCategory
                }).ToList();

                return Ok(pinDtos);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }
        [HttpDelete("delete-profile-picture")]
        public async Task<IActionResult> DeleteProfilePicture()
        {
            var userId = int.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier).Value);
            var user = await _context.Users.FirstOrDefaultAsync(u => u.UserId == userId);

            if (user == null)
                return NotFound(new { message = _localizer["user.not_found"].ToString() });

            if (!string.IsNullOrEmpty(user.ProfilePicture))
            {
                // Assume user.ProfilePicture is stored like "/profile-images/filename.jpg"
                var relativePath = user.ProfilePicture.TrimStart('/');
                var absolutePath = Path.Combine(_env.WebRootPath, relativePath);

                if (System.IO.File.Exists(absolutePath))
                {
                    try
                    {
                        System.IO.File.Delete(absolutePath);
                    }
                    catch (Exception ex)
                    {
                        return StatusCode(500, new { message = string.Format(_localizer["common.image_delete_error"].ToString(), ex.Message) });
                    }
                }

                user.ProfilePicture = "";
                await _context.SaveChangesAsync();
            }

            return Ok(new { message = _localizer["user.profile_picture_deleted"].ToString() });
        }

        [HttpPut("profile-image")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> UploadProfileImage([FromForm] UploadImageDto model)
        {
            try
            {
                var userId = int.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier).Value);

                var user = await _context.Users.FirstOrDefaultAsync(u => u.UserId == userId);
                if (user == null)
                    return NotFound(new { message = _localizer["user.not_found"].ToString() });

                
                if (model.Image == null || model.Image.Length == 0)
                    return BadRequest(new { message = _localizer["common.image_not_found"].ToString() });

                
                var allowedExtensions = new[] { ".jpg", ".jpeg", ".png" };
                var fileExtension = Path.GetExtension(model.Image.FileName).ToLowerInvariant();
                if (!allowedExtensions.Contains(fileExtension))
                    return BadRequest(new { message = _localizer["common.invalid_image_format"].ToString() });

                
                if (model.Image.Length > 2 * 1024 * 1024)
                    return BadRequest(new { message = _localizer["common.image_too_large"].ToString() });

                
                string imageName = await CommonHelpers.SaveImageAsync(model.Image, _env);

                
                if (!string.IsNullOrEmpty(user.ProfilePicture))
                {
                    await CommonHelpers.RemovePhoto(user.ProfilePicture, _env);
                }

                
                user.ProfilePicture = imageName;
                _context.Users.Update(user);
                await _context.SaveChangesAsync();

                return Ok(new
                {
                    message = _localizer["user.profile_picture_updated"].ToString(),
                    imageUrl = imageName
                });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

    }
}
