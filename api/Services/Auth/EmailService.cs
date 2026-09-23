using DailyTrackerAPI.Models.Attendance;
using DailyTrackerAPI.Models.HR;
using System.Net;
using System.Net.Mail;

namespace DailyTrackerAPI.Services.Auth
{
    public interface IEmailService
    {
        Task SendOtpEmailAsync(string email, string code, string purpose);
        Task SendWelcomeEmailAsync(string email, string fullName);
        Task SendLeaveAppliedEmailAsync(string to, string managerName, string employeeName, LeaveRequest leave, string token);
        Task SendLeaveReviewedEmailAsync(string to, string employeeName, string managerName, LeaveRequest leave, string status, string? note);
        Task SendWFHAppliedEmailAsync(string to,string managerName,string employeeName,WFHRequest request,string token);
        Task SendWFHReviewedEmailAsync(string to,string employeeName,string managerName,WFHRequest request,string status,string? note);
    }
    public class EmailService : IEmailService
    {
        private readonly IConfiguration _config;

        public EmailService(IConfiguration config)
        {
            _config = config;
        }

        public async Task SendOtpEmailAsync(string email, string code, string purpose)
        {
            var subject = $"Your OTP for {purpose}";
            var body = $@"
            <!DOCTYPE html>
            <html>
            <body style='margin:0;padding:0;background-color:#f4f6f9;font-family:Arial,sans-serif;'>

                <table width='100%' cellpadding='0' cellspacing='0' style='padding:20px 0;'>
                    <tr>
                        <td align='center'>
                    
                            <table width='600' cellpadding='0' cellspacing='0' 
                                   style='background:#ffffff;border-radius:8px;padding:30px;'>

                                <tr>
                                    <td align='center' style='padding-bottom:20px;'>
                                        <h2 style='color:#2c3e50;margin:0;'>
                                            Employee Management System
                                        </h2>
                                    </td>
                                </tr>

                                <tr>
                                    <td style='font-size:16px;color:#333;'>
                                        <p>Hello,</p>
                                        <p>You requested an OTP for <strong>{purpose}</strong>.</p>
                                    </td>
                                </tr>

                                <tr>
                                    <td align='center' style='padding:20px 0;'>
                                        <div style='
                                            display:inline-block;
                                            background-color:#007bff;
                                            color:#ffffff;
                                            font-size:24px;
                                            letter-spacing:4px;
                                            padding:15px 30px;
                                            border-radius:6px;
                                            font-weight:bold;'>
                                            {code}
                                        </div>
                                    </td>
                                </tr>

                                <tr>
                                    <td style='font-size:14px;color:#666;'>
                                        <p>This OTP will expire in <strong>5 minutes</strong>.</p>
                                        <p>If you did not request this, please ignore this email.</p>
                                    </td>
                                </tr>

                                <tr>
                                    <td style='padding-top:20px;font-size:12px;color:#999;text-align:center;'>
                                        © {DateTime.Now.Year} Employee Management System
                                    </td>
                                </tr>

                            </table>

                        </td>
                    </tr>
                </table>

            </body>
            </html>";

            await SendEmailAsync(email, subject, body);
        }

        public async Task SendWelcomeEmailAsync(string email, string fullName)
        {
            var subject = "Welcome to Employee Management System";
            var body = $@"
            <!DOCTYPE html>
            <html>
            <body style='margin:0;padding:0;background-color:#f4f6f9;font-family:Arial,sans-serif;'>

                <table width='100%' cellpadding='0' cellspacing='0' style='padding:20px 0;'>
                    <tr>
                        <td align='center'>

                            <table width='600' cellpadding='0' cellspacing='0' 
                                   style='background:#ffffff;border-radius:8px;padding:30px;'>

                                <tr>
                                    <td align='center' style='padding-bottom:20px;'>
                                        <h2 style='color:#2c3e50;margin:0;'>
                                            🎉 Welcome to Employee Management System
                                        </h2>
                                    </td>
                                </tr>

                                <tr>
                                    <td style='font-size:16px;color:#333;'>
                                        <p>Hi <strong>{fullName}</strong>,</p>

                                        <p>
                                            Your account has been created successfully.
                                            We are excited to have you onboard!
                                        </p>

                                        <table width='100%' cellpadding='10' cellspacing='0' 
                                               style='background:#f8f9fa;border-radius:6px;margin:15px 0;'>
                                            <tr>
                                                <td>
                                                    <strong>Email:</strong> {email}
                                                </td>
                                            </tr>
                                        </table>

                                        <p>
                                            Please login and keep your password secure.
                                        </p>

                                        <p style='margin-top:25px;'>
                                            Best Regards,<br/>
                                            <strong>HR Team</strong><br/>
                                            Employee Management System
                                        </p>
                                    </td>
                                </tr>

                                <tr>
                                    <td style='padding-top:20px;font-size:12px;color:#999;text-align:center;'>
                                        © {DateTime.Now.Year} Employee Management System. All rights reserved.
                                    </td>
                                </tr>

                            </table>

                        </td>
                    </tr>
                </table>

            </body>
            </html>";

            await SendEmailAsync(email, subject, body);
        }
        public async Task SendLeaveAppliedEmailAsync(string to,string managerName,string employeeName,LeaveRequest leave,string token)
        {
            var subject = $"New Leave Request from {employeeName}";

            var frontendUrl = _config["FrontendUrl"];

            var approveUrl = $"{frontendUrl}/email-action?token={token}&status=Approved";
            var rejectUrl = $"{frontendUrl}/email-action?token={token}&status=Rejected";

            var body = $@"
                <html>
                <body style='margin:0;padding:0;background:#f4f6f9;font-family:Segoe UI;'>

                <table width='100%' cellpadding='0' cellspacing='0' style='padding:30px 0;'>
                <tr>
                <td align='center'>

                <table width='600' cellpadding='0' cellspacing='0'
                style='background:#ffffff;border-radius:10px;padding:30px;'>

                <tr>
                <td>

                <h2 style='color:#2563eb;margin-top:0;'>New Leave Request</h2>

                <p>Hi <strong>{managerName}</strong>,</p>

                <p><strong>{employeeName}</strong> has applied for leave.</p>

                <table width='100%' cellpadding='6' cellspacing='0'
                style='background:#f9fafb;border-radius:6px;margin:15px 0;'>

                <tr><td width='120'><b>Type:</b></td><td>{leave.LeaveType}</td></tr>
                <tr><td><b>From:</b></td><td>{leave.FromDate:dd MMM yyyy}</td></tr>
                <tr><td><b>To:</b></td><td>{leave.ToDate:dd MMM yyyy}</td></tr>
                <tr><td><b>Reason:</b></td><td>{leave.Reason}</td></tr>

                </table>

                <div style='margin-top:25px;text-align:center;'>

                <a href='{approveUrl}'
                style='background:#16a34a;color:white;padding:10px 18px;
                text-decoration:none;border-radius:6px;margin-right:10px;
                display:inline-block;font-weight:600;'>
                Approve
                </a>

                <a href='{rejectUrl}'
                style='background:#dc2626;color:white;padding:10px 18px;
                text-decoration:none;border-radius:6px;
                display:inline-block;font-weight:600;'>
                Reject
                </a>

                </div>

                <p style='margin-top:20px;color:#777;font-size:13px;'>
                This link expires in 24 hours.
                </p>

                </td>
                </tr>

                </table>

                </td>
                </tr>
                </table>

                </body>
                </html>";

            await SendEmailAsync(to, subject, body);
        }

        public async Task SendLeaveReviewedEmailAsync(string to,string employeeName,string managerName,LeaveRequest leave,string status,string? note)
        {
            var subject = $"Your Leave Request is {status}";

            var color = status == "Approved" ? "#16a34a" : "#dc2626";
            var bgColor = status == "Approved" ? "#ecfdf5" : "#fef2f2";
            var badgeColor = status == "Approved" ? "#22c55e" : "#ef4444";

            var body = $@"
            <!DOCTYPE html>
            <html>
            <head>
            <meta charset='UTF-8'>
            </head>
            <body style='margin:0;padding:0;background-color:#f3f4f6;font-family:Arial,sans-serif;'>

            <table width='100%' cellpadding='0' cellspacing='0'>
            <tr>
            <td align='center'>

            <table width='600' cellpadding='0' cellspacing='0' 
                   style='background:#ffffff;margin:30px 0;border-radius:12px;overflow:hidden;
                          box-shadow:0 4px 12px rgba(0,0,0,0.08);'>

            <!-- Header -->
            <tr>
            <td style='background:{color};padding:20px;text-align:center;color:white;'>
                <h2 style='margin:0;'>Leave Request {status}</h2>
            </td>
            </tr>

            <!-- Body -->
            <tr>
            <td style='padding:30px;'>

            <p style='font-size:15px;margin:0 0 15px;'>Hi <b>{employeeName}</b>,</p>

            <p style='font-size:14px;margin:0 0 20px;line-height:1.6;color:#374151;'>
            Your leave request has been 
            <span style='background:{bgColor};
                         color:{badgeColor};
                         padding:6px 12px;
                         border-radius:20px;
                         font-weight:bold;
                         font-size:13px;'>
                {status}
            </span>
            by <b>{managerName}</b>.
            </p>

            <table width='100%' cellpadding='8' cellspacing='0' 
                   style='border-collapse:collapse;font-size:14px;'>

            <tr style='background:#f9fafb;'>
            <td style='border:1px solid #e5e7eb;'><b>Leave Type</b></td>
            <td style='border:1px solid #e5e7eb;'>{leave.LeaveType}</td>
            </tr>

            <tr>
            <td style='border:1px solid #e5e7eb;'><b>From</b></td>
            <td style='border:1px solid #e5e7eb;'>{leave.FromDate:dd MMM yyyy}</td>
            </tr>

            <tr style='background:#f9fafb;'>
            <td style='border:1px solid #e5e7eb;'><b>To</b></td>
            <td style='border:1px solid #e5e7eb;'>{leave.ToDate:dd MMM yyyy}</td>
            </tr>

            </table>

            {(string.IsNullOrEmpty(note) ? "" : $@"
            <div style='margin-top:20px;padding:15px;
                        background:#f3f4f6;border-radius:8px;'>
                <p style='margin:0;font-size:13px;'>
                    <b>Manager Note:</b><br/>
                    {note}
                </p>
            </div>
            ")}

            <p style='margin-top:30px;font-size:13px;color:#6b7280;'>
            If you have any questions, please contact your manager.
            </p>

            </td>
            </tr>

            <!-- Footer -->
            <tr>
            <td style='background:#f9fafb;padding:15px;text-align:center;
                       font-size:12px;color:#9ca3af;'>
                © {DateTime.UtcNow.Year} Employee Management System
            </td>
            </tr>

            </table>

            </td>
            </tr>
            </table>

            </body>
            </html>";

            await SendEmailAsync(to, subject, body);
        }
        public async Task SendWFHAppliedEmailAsync(string to,string managerName,string employeeName,WFHRequest request,string token)
        {
            var subject = $"New {request.RequestType} Request from {employeeName}";

            var frontendUrl = _config["FrontendUrl"];

            var approveUrl = $"{frontendUrl}/wfh-email-action?token={token}&status=Approved";
            var rejectUrl = $"{frontendUrl}/wfh-email-action?token={token}&status=Rejected";

            var body = $@"
                <html>
                <body style='font-family:Segoe UI;background:#f4f6f9;padding:30px;'>

                <h2>New {request.RequestType} Request</h2>

                <p>Hi <b>{managerName}</b>,</p>

                <p><b>{employeeName}</b> applied for:</p>

                <table>
                    <tr><td><b>Date:</b></td><td>{request.RequestDate:dd MMM yyyy}</td></tr>
                    <tr><td><b>Type:</b></td><td>{request.RequestType}</td></tr>
                    {(request.RequestType == "HalfDay" ? $"<tr><td><b>Slot:</b></td><td>{request.HalfDaySlot}</td></tr>" : "")}
                    <tr><td><b>Reason:</b></td><td>{request.Reason}</td></tr>
                </table>

                <br/>

                <a href='{approveUrl}' 
                   style='background:#16a34a;color:white;padding:10px 20px;
                          text-decoration:none;border-radius:6px;margin-right:10px;'>
                   Approve
                </a>

                <a href='{rejectUrl}'
                   style='background:#dc2626;color:white;padding:10px 20px;
                          text-decoration:none;border-radius:6px;'>
                   Reject
                </a>

                <p style='margin-top:20px;font-size:12px;color:#777'>
                    This link expires in 24 hours.
                </p>

                </body>
                </html>";

            await SendEmailAsync(to, subject, body);
        }
        public async Task SendWFHReviewedEmailAsync(string to,string employeeName,string managerName,WFHRequest request,string status,string? note)
        {
            var subject = $"Your {request.RequestType} Request is {status}";

            var color = status == "Approved" ? "#16a34a" : "#dc2626";

            var body = $@"
                <html>
                <body style='font-family:Segoe UI;background:#f4f6f9;padding:30px;'>

                <h2 style='color:{color};'>
                    {request.RequestType} Request {status}
                </h2>

                <p>Hi <b>{employeeName}</b>,</p>

                <p>Your request for <b>{request.RequestDate:dd MMM yyyy}</b>
                   has been <b>{status}</b> by {managerName}.</p>

                {(string.IsNullOrEmpty(note) ? "" : $"<p><b>Manager Note:</b> {note}</p>")}

                <p>Regards,<br/>Employee Management System</p>

                </body>
                </html>";

            await SendEmailAsync(to, subject, body);
        }

        private async Task SendEmailAsync(string to, string subject, string body)
        {
            try
            {
                using var smtp = new SmtpClient(_config["Email:Smtp"], int.Parse(_config["Email:Port"]))
                {
                    Credentials = new NetworkCredential(
                        _config["Email:Username"],
                        _config["Email:Password"]
                    ),
                    EnableSsl = true,
                    DeliveryMethod = SmtpDeliveryMethod.Network,
                    UseDefaultCredentials = false
                };

                using var mail = new MailMessage
                {
                    From = new MailAddress(
                        _config["Email:Username"],
                        "Employee Management System"
                    ),
                    Subject = subject,
                    Body = body,
                    IsBodyHtml = true
                };

                mail.To.Add(to);

                await smtp.SendMailAsync(mail);
            }
            catch (Exception ex)
            {
                // log error properly in real project
                throw new Exception("Email sending failed", ex);
            }
        }
    }
}
