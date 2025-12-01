require("dotenv").config();
const express = require("express");
const getDBConnection = require('../../config/db');
const router = express.Router();
const multer = require("multer");

const sgMail = require("@sendgrid/mail");

const db = getDBConnection('dbug');

// ✅ Set your SendGrid API key
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Lookup employee by email
router.get("/employee/:email", (req, res) => {
    const email = req.params.email;

    const query = `SELECT * FROM dadmin.employee WHERE emp_mail_id = ? AND deleted_time IS NULL `;
    db.query(query, [email], (err, results) => {
        if (err) {
            console.error(`❌ Database error while fetching employee ${email}:`, err);
            return res.status(500).json({ error: "Database error" });
        }

        if (results.length === 0) {
            console.warn(`⚠️ Employee not found for email: ${email}`);
            return res.status(404).json({ error: "Employee not found" });
        }

        // 🔥 CHECK HERE — if app_dAssist = 0, block access
        if (results[0].app_dBug === 0) {
            return res.status(401).json({
                message: "Access denied. You don't have access for dBug."
            });
        }

        // If everything is fine, return the result
        return res.json(results[0]);
    });
});

// ✅ Send OTP API with Employee Validation
router.post("/send-otp", (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email required" });

    // ✅ Check if Employee exists
    const query = `SELECT * FROM dadmin.employee WHERE emp_mail_id = ? AND deleted_time IS NULL`;
    db.query(query, [email], (err, results) => {
        if (err) return res.status(500).json({ message: "Database error" });
        if (results.length === 0) return res.status(404).json({ message: "Employee not found" });

        // ✅ Employee exists → Generate OTP
        generateOTP(email, res);
    });
});

// 🔹 Generate OTP Function
const generateOTP = async (userInput, res) => {
    try {
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiryTime = new Date(Date.now() + 5 * 60000);

        const query = `INSERT INTO dadmin.otpstorage (UserInput, OTP, ExpiryTime) 
                       VALUES (?, ?, ?) 
                       ON DUPLICATE KEY UPDATE OTP = ?, ExpiryTime = ?`;

        // Wrap DB query in a promise to use async/await
        await new Promise((resolve, reject) => {
            db.query(query, [userInput, otp, expiryTime, otp, expiryTime], (err) => {
                if (err) return reject(err);
                resolve();
            });
        });

        // ✅ Compose SendGrid email
        const msg = {
            to: userInput,
            from: '"dbug Support" <support@dolluzcorp.in>',
            subject: "dbug - Verify Your Email Address",
            html: `
                <div style="font-family: Arial, sans-serif; padding: 15px; border: 1px solid #ddd; border-radius: 8px;">
                    <h2 style="color: #4A90E2;">dbug - Email Verification</h2>
                    <p>Hello,</p>
                    <p>We received a request to verify your email for accessing <strong>dbug</strong>.</p>
                    <p>Please use the OTP below to complete your verification:</p>
                    <h3 style="color: #333; font-size: 24px;">${otp}</h3>
                    <p>This OTP is valid for <strong>2 minutes</strong>. Do not share it with anyone.</p>
                    <p>If you did not request this verification, please ignore this message.</p>
                    <br/>
                    <p style="color: #888;">- The dbug Team</p>
                </div>
            `,
        };

        await sgMail.send(msg);

        // ✅ Only send success response if both DB and email succeed
        res.json({ message: "OTP sent successfully" });

    } catch (error) {
        console.error("❌ Error generating OTP or sending email:", error);
        res.status(500).json({ message: "Failed to generate OTP or send email" });
    }
};

// ✅ Verify OTP API
router.post("/verify-otp", (req, res) => {
    const { email, otp } = req.body;

    if (!email || !otp) {
        return res.status(400).json({ message: "Email and OTP required" });
    }

    const query = `SELECT * FROM dadmin.otpstorage WHERE UserInput = ?`;

    db.query(query, [email], (err, results) => {
        if (err) return res.status(500).json({ message: "Database error" });
        if (results.length === 0) return res.status(404).json({ message: "OTP not found" });

        const storedOtp = results[0];

        if (storedOtp.OTP !== otp) {
            return res.status(401).json({ message: "Invalid OTP" });
        }

        if (new Date() > new Date(storedOtp.ExpiryTime)) {
            return res.status(410).json({ message: "OTP expired" });
        }

        return res.json({ message: "OTP verified" });
    });
});

const ticketUpload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, "Tickets_file_uploads/"),
        filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
    }),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

// 🔹 Submit ticket details + send email
router.post("/submit", ticketUpload.array("attachments"), async (req, res) => {
    const data = req.body;
    const attachmentPaths = req.files ? req.files.map((f) => f.path) : [];

    try {
        // 🔹 Fetch submitting employee details
        const [empResult] = await new Promise((resolve, reject) => {
            db.query(
                "SELECT emp_first_name, emp_last_name, emp_mail_id FROM dadmin.employee WHERE emp_id = ?",
                [data.emp_id],
                (err, results) => {
                    if (err) return reject(err);
                    resolve(results);
                }
            );
        });

        if (!empResult) {
            return res.status(400).json({ message: "Invalid employee ID" });
        }

        // 🔹 Insert ticket into DB
        const insertQuery = `
            INSERT INTO tickets_entry
            (ticket_id, emp_id, issue_type, summary, description, attachment_file, assignee,
             priority_level, reporting_team, testing_type, device_tested, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const placeholderId = "TEMP";

        const descriptionValue = Array.isArray(data.description)
            ? data.description.join("\n")
            : data.description || "";

        const attachmentValue =
            attachmentPaths.length > 0 ? JSON.stringify(attachmentPaths) : null;

        const devicesTestedValue =
            data.devicesTested && typeof data.devicesTested !== "string"
                ? JSON.stringify(data.devicesTested)
                : data.devicesTested || null;

        const insertResult = await new Promise((resolve, reject) => {
            db.query(
                insertQuery,
                [
                    placeholderId,
                    data.emp_id,
                    data.issue_type,
                    data.summary,
                    descriptionValue,
                    attachmentValue,
                    data.assignee,
                    data.priority_level || null,
                    data.reporting_team || null,
                    data.testing_type || null,
                    devicesTestedValue,
                    data.emp_id,
                ],
                (err, result) => {
                    if (err) return reject(err);
                    resolve(result);
                }
            );
        });

        // 🔹 Generate formatted ticket ID
        const autoId = insertResult.insertId;
        const formattedId = `DZDXT-${autoId}`;

        // 🔹 Update ticket_id in DB
        await new Promise((resolve, reject) => {
            db.query(
                "UPDATE tickets_entry SET ticket_id = ? WHERE auto_id = ?",
                [formattedId, autoId],
                (err) => {
                    if (err) return reject(err);
                    resolve();
                }
            );
        });

        // 🔹 Determine terms based on issue type
        const isBug = data.issue_type.toLowerCase() === "bug";
        const issueWord = isBug ? "Bug" : "Idea";

        // -----------------------
        // ✉️ Mail to ticket submitter
        // -----------------------
        const userMailSubject = isBug
            ? `[Defect ID: ${formattedId}] Update on your Bug`
            : `[Idea ID: ${formattedId}] Update on your Idea`;

        const userMailBody = `
            <div style="font-family: Arial, sans-serif; padding: 15px; border: 1px solid #ddd; border-radius: 8px;">
              <h2 style="color: #4A90E2;">${issueWord} Submission Confirmation</h2>
              <p>Hello <strong>${empResult.emp_first_name} ${empResult.emp_last_name}</strong>,</p>
              <p>Your ${issueWord.toLowerCase()} <strong>${formattedId}</strong> regarding "<em>${data.summary}</em>" has been <strong>Submitted</strong>.</p>
              <p><strong>Current Status:</strong> Submitted</p>
              <p><strong>Latest Comment:</strong> - </p>
              <br/>
              <p>For any concerns, amendments, or notes, please write to 
              <a href="mailto:admin@dolluzcorp.in">admin@dolluzcorp.in</a> 
              with the ${issueWord} ID in the subject line.</p>
              <br/>
              <p style="color: #888;">— Dolluz Support Team</p>
            </div>
        `;

        const msgToUser = {
            from: '"Dolluz Support" <support@dolluzcorp.in>',
            to: data.email,
            subject: userMailSubject,
            html: userMailBody,
        };

        await sgMail.send(msgToUser);

        // -----------------------
        // ✉️ Mail to Assignee
        // -----------------------

        // Find assignee email by matching full name
        const [assigneeResult] = await new Promise((resolve, reject) => {
            db.query(
                `SELECT emp_mail_id FROM dadmin.employee 
                 WHERE CONCAT(TRIM(emp_first_name), ' ', TRIM(emp_last_name)) = ?`,
                [data.assignee.trim()],
                (err, results) => {
                    if (err) return reject(err);
                    resolve(results);
                }
            );
        });

        if (assigneeResult) {
            const assigneeMailSubject = isBug
                ? `[Defect ID: ${formattedId}] Bug Notification`
                : `[Idea ID: ${formattedId}] Idea Notification`;

            const assigneeMailBody = `
                <div style="font-family: Arial, sans-serif; padding: 15px; border: 1px solid #ddd; border-radius: 8px;">
                  <h2 style="color: #4A90E2;">New ${issueWord} Assigned</h2>
                  <p>Hello <strong>${data.assignee}</strong>,</p>
                  <p>You have been assigned a new ${issueWord.toLowerCase()} <strong>${formattedId}</strong> submitted by 
                  <strong>${empResult.emp_first_name} ${empResult.emp_last_name}</strong>.</p>
                  <p><strong>Summary:</strong> ${data.summary}</p>
                  <p><strong>Status:</strong> Submitted</p>
                  <br/>
                  <p>Please review the details and take necessary action.</p>
                  <br/>
                  <p style="color: #888;">— Dolluz Support Team</p>
                </div>
            `;

            const msgToAssignee = {
                from: '"Dolluz Support" <support@dolluzcorp.in>',
                to: assigneeResult.emp_mail_id,
                subject: assigneeMailSubject,
                html: assigneeMailBody,
            };

            await sgMail.send(msgToAssignee);
        }

        return res.json({
            message: "Ticket submitted and emails sent successfully",
            ticket_id: formattedId,
            employeeName: `${empResult.emp_first_name} ${empResult.emp_last_name}`,
            issueType: issueWord,
        });

    } catch (error) {
        console.error("❌ Error submitting ticket or sending email:", error);
        res.status(500).json({ message: "Failed to submit ticket or send email" });
    }
});

module.exports = router;
