import React, { useState, useRef, useEffect } from "react";
import DOLLUZ_CORP_thin_line_logo from "./assets/img/DOLLUZ_CORP_thin_line_logo.png";
import { apiFetch } from "./utils/api";
import Swal from "sweetalert2";
import { FaTimes } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import Select from "react-select";
import { useQuill } from "react-quilljs";
import "quill/dist/quill.snow.css";
import "./Tickets.css";

const Tickets = () => {
    const [emailError, setEmailError] = useState("");
    const [errors, setErrors] = useState({});
    const navigate = useNavigate();
    const [isSubmitting, setIsSubmitting] = useState(false); // ✅ Loading state
    const [showPriority, setShowPriority] = useState(false);
    const [showContact, setShowContact] = useState(false);
    const priorityRef = useRef(null);
    const contactRef = useRef(null);
    const [otpCode, setOtpCode] = useState("");
    const [otpVerified, setOtpVerified] = useState(false);
    const [otpError, setOtpError] = useState("");
    const [isSendingOtp, setIsSendingOtp] = useState(false);
    const [showOtpField, setShowOtpField] = useState(false);
    const [emailVerified, setEmailVerified] = useState(false);
    const [issueType, setIssueType] = useState(""); // "Bug" or "Idea"

    const deviceOptions = [
        { value: "Desktop", label: "Desktop" },
        { value: "Tablet", label: "Tablet" },
        { value: "Mobile - Android", label: "Mobile - Android" },
        { value: "Mobile - iOS", label: "Mobile - iOS" },
    ];

    const { quill: bugQuill, quillRef: bugQuillRef } = useQuill({
        theme: "snow",
        modules: {
            toolbar: [["bold", "italic", "underline", "strike"],
            [{ list: "ordered" }, { list: "bullet" }],
            [{ align: [] }], ["clean"],],
        },
        formats: ["bold", "italic", "underline", "strike", "list", "bullet", "align",],
    });

    const { quill: ideaQuill, quillRef: ideaQuillRef } = useQuill({
        theme: "snow",
        modules: {
            toolbar: [["bold", "italic", "underline", "strike"],
            [{ list: "ordered" }, { list: "bullet" }],
            [{ align: [] }], ["clean"],],
        },
        formats: ["bold", "italic", "underline", "strike", "list", "bullet", "align",],
    });

    // listen for changes
    useEffect(() => {
        const editor = issueType === "Bug" ? bugQuill : issueType === "Idea" ? ideaQuill : null;
        if (!editor) return;

        // set default template only once (when editor loads)
        if (editor && editor.getText().trim().length === 0) {
            editor.root.innerHTML = `
            <p><strong>Steps to Reproduce:</strong><br>------------------------------------</p>
            <p><strong>Test Data:</strong><br>------------------------------------</p>
            <p><strong>Expected Result:</strong><br>------------------------------------</p>
            <p><strong>Actual Result:</strong><br>------------------------------------</p>
        `;
        }

        const handler = () => handleDescriptionChange(editor.root.innerHTML);
        editor.on("text-change", handler);

        return () => {
            editor.off("text-change", handler);
        };
    }, [issueType, bugQuill, ideaQuill]);

    const priorities = [
        {
            value: "High",
            label: "High",
            icon: (
                <span style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <i className="fa-solid fa-angle-up" style={{ color: "red", fontSize: "15px", lineHeight: "0.5" }}></i>
                    <i className="fa-solid fa-angle-up" style={{ color: "red", fontSize: "11px", lineHeight: "0.5" }}></i>
                    <i className="fa-solid fa-angle-up" style={{ color: "red", fontSize: "9px", lineHeight: "0.5" }}></i>
                </span>
            ),
        },
        {
            value: "Medium",
            label: "Medium",
            icon: (
                <span style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <i className="fa-solid fa-angle-up" style={{ color: "#FF8C00", fontSize: "14px", lineHeight: "0.6" }}></i>
                    <i className="fa-solid fa-angle-up" style={{ color: "#FF8C00", fontSize: "10px", lineHeight: "0.6" }}></i>
                </span>
            ),
        },
        {
            value: "Low",
            label: "Low",
            icon: (
                <span style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <i className="fa-solid fa-angle-up" style={{ color: "green", fontSize: "14px", lineHeight: "0.6" }}></i>
                </span>
            ),
        },
    ];

    useEffect(() => {
        const handleOutsideClick = (e) => {
            // Close Priority dropdown if clicked outside
            if (priorityRef.current && !priorityRef.current.contains(e.target)) {
                setShowPriority(false);
            }

            // Close Contact dropdown if clicked outside
            if (contactRef.current && !contactRef.current.contains(e.target)) {
                setShowContact(false);
            }
        };

        document.addEventListener("mousedown", handleOutsideClick);

        return () => {
            document.removeEventListener("mousedown", handleOutsideClick);
        };
    }, []);

    const [formData, setFormData] = useState({
        emp_id: "",
        email: "",
        issue_type: "",
        summary: "",
        description: "",
        attachment_file: null,
        assignee: "",
        priority_level: "",
        reporting_team: "",
        testing_type: "",
        device_tested: [],
    });

    const fileInputRef = useRef(null);

    const handleFileChange = (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;

        const validFiles = [];

        for (let file of files) {
            if (file.size > 0.5 * 1024 * 1024) {
                Swal.fire({
                    icon: "error",
                    title: "File Too Large",
                    text: `${file.name} exceeds 0.5 MB limit`,
                });
                continue;
            }
            validFiles.push(file);
        }

        if (validFiles.length) {
            setFormData((prev) => ({
                ...prev,
                attachments: [...(prev.attachments || []), ...validFiles],
            }));
        }

        e.target.value = null; // allow re-uploading same file name
    };

    const removeFile = (index) => {
        setFormData((prev) => {
            const updated = [...prev.attachments];
            updated.splice(index, 1);
            return { ...prev, attachments: updated };
        });

        if (fileInputRef.current) fileInputRef.current.value = null;
    };

    // ✅ Handle field changes
    const handleChange = async (e) => {
        const { name, value, type, files } = e.target;

        setFormData((prev) => ({
            ...prev,
            [name]: type === "file" ? files[0] : value,
        }));

        if (name === "email") {
            setEmailError("");
        }
    };

    const handleEmailSubmit = async () => {
        const value = formData.email;

        if (!value || !value.includes("@")) {
            setEmailError("Invalid email format.");
            return;
        }

        try {
            const res = await apiFetch(`/api/tickets/employee/${value}`);
            if (!res.ok) throw new Error("Employee not found");

            const data = await res.json();
            setFormData((prev) => ({
                ...prev,
                emp_id: data.emp_id,
            }));

            // ✅ Email is now verified
            setEmailVerified(true);
            // ✅ Start Loader
            setIsSendingOtp(true);

            const otpResponse = await apiFetch("/api/tickets/send-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: value }),
            });

            // ✅ Stop Loader
            setIsSendingOtp(false);

            if (otpResponse.ok) {
                setShowOtpField(true);
                Swal.fire({
                    icon: "success",
                    title: "OTP Sent!",
                    text: "Please check your registered email for the OTP.",
                });
            } else {
                Swal.fire({
                    icon: "error",
                    title: "Failed to send OTP",
                    text: "Please try again later.",
                });
            }

            setOtpVerified(false); // reset OTP verification
            setOtpCode("");
            setOtpError("");

        } catch (err) {
            setIsSendingOtp(false);
            setShowOtpField(false);
            setEmailError("This email is not registered with Dolluz Corp. Please contact admin (admin@dolluzcorp.in).");
            setFormData((prev) => ({ ...prev, emp_id: null, emp_first_name: "", emp_last_name: "" }));
        }
    };

    const handleOtpChange = (e) => {
        const value = e.target.value.replace(/\D/g, ""); // Only digits
        setOtpCode(value);

        if (value.length === 6) {
            verifyOTP(value);
        } else {
            setOtpError(""); // Clear error while typing
        }
    };

    const verifyOTP = async (code) => {
        setOtpError("");

        try {
            const res = await apiFetch("/api/tickets/verify-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: formData.email, otp: code }),
            });

            const data = await res.json();

            if (res.ok) {
                setOtpVerified(true);
                setOtpError("");
            } else {
                setOtpError(data.message || "Invalid OTP");
                setOtpVerified(false);
            }
        } catch (err) {
            setOtpError("Error verifying OTP. Please try again.");
            setOtpVerified(false);
        }
    };

    const handleDescriptionChange = (value) => {
        setFormData((prev) => ({
            ...prev,
            description: value,
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        // Required fields based on tickets_entry table
        const requiredFields = ["emp_id", "issue_type", "summary", "assignee"];

        for (let field of requiredFields) {
            if (!formData[field] || (Array.isArray(formData[field]) && !formData[field].length)) {
                Swal.fire({
                    icon: "error",
                    title: "Validation Error",
                    text: `${field.replace(/_/g, " ")} is required`,
                });
                setIsSubmitting(false);
                return;
            }
        }

        // Validate Quill description length
        let plainTextDescription = "";
        if (issueType === "Bug" && bugQuill) plainTextDescription = bugQuill.getText().trim();
        else if (issueType === "Idea" && ideaQuill) plainTextDescription = ideaQuill.getText().trim();

        if (plainTextDescription.length < 300 || plainTextDescription.length > 5000) {
            Swal.fire({
                icon: "error",
                title: "Validation Error",
                text: "Description must be between 300 and 5000 characters",
            });
            setIsSubmitting(false);
            return;
        }

        // Build FormData for submission
        const formDataToSend = new FormData();

        // Append all fields from formData
        for (const key in formData) {
            if (key !== "attachments" && formData[key]) {
                if (Array.isArray(formData[key])) {
                    formDataToSend.append(key, JSON.stringify(formData[key]));
                } else {
                    formDataToSend.append(key, formData[key]);
                }
            }
        }

        // Append description from Quill
        formDataToSend.append("description", plainTextDescription);

        // ✅ Append multiple attachments (important part)
        if (formData.attachments && formData.attachments.length > 0) {
            formData.attachments.forEach((file) => {
                formDataToSend.append("attachments", file);
            });
        }

        // Append created_by as emp_id
        if (formData.emp_id) {
            formDataToSend.append("created_by", formData.emp_id);
        } else {
            Swal.fire({
                icon: "warning",
                title: "Validation Error",
                text: "Please select a valid employee before submitting the ticket.",
            });
            setIsSubmitting(false);
            return;
        }

        try {
            const res = await apiFetch("/api/tickets/submit", {
                method: "POST",
                body: formDataToSend,
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error submitting ticket");

            // Redirect to Thank_You page
            navigate("/thank-you", {
                state: {
                    employeeName: formData.emp_id,
                    ticketId: data.ticket_id,
                },
            });

            setTimeout(() => {
                setFormData({
                    emp_id: "",
                    issue_type: "",
                    summary: "",
                    description: "",
                    attachment_file: [],
                    assignee: "",
                    priority_level: "",
                    reporting_team: "",
                    testing_type: "",
                    device_tested: [],
                });

                setErrors({});
                if (fileInputRef.current) fileInputRef.current.value = null;
            }, 0);

        } catch (err) {
            Swal.fire({
                icon: "error",
                title: "Submission Error",
                text: err.message,
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="tickets-container">
            <div className="ticket-card">
                <div className="ticket-logo">
                    <a className="navbar-brand" href="#">
                        <div className="ticket-logo">
                            <a className="navbar-brand" href="#">
                                <img
                                    src={DOLLUZ_CORP_thin_line_logo}
                                    alt="dbug logo_eagle"
                                />
                            </a>
                        </div>
                    </a>
                </div>

                <form className="ticket-form" onSubmit={handleSubmit}>
                    {/* Email */}
                    <label>Email {errors.email && <span style={{ color: "red" }}>* </span>} </label>
                    <div className="email-input-container">
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            disabled={emailVerified}  // ✅ Disable when verified
                            className={emailError ? "invalid" : ""}
                        />

                        {/* Show Arrow Icon Only When "@" Exists AND not yet verified */}
                        {(formData.email || "").includes("@") && !emailVerified && !showOtpField && (
                            <i className="fa-solid fa-arrow-right email-action-icon" onClick={handleEmailSubmit}></i>
                        )}

                        {/* ✅ Show Success Icon When Email is Verified (not waiting for OTP) */}
                        {emailVerified && (
                            <i className="fa-solid fa-circle-check email-valid-icon"></i>
                        )}
                    </div>

                    {emailError && <p style={{ color: "red" }}>{emailError}</p>}

                    {/* Loader while sending OTP */}
                    {isSendingOtp && <div className="spinner"></div>}

                    {/* OTP Section */}
                    {showOtpField && !otpVerified && (
                        <div className="otp-section mt-2">
                            <label>Enter OTP</label>
                            <div className="otp-input-container">
                                <input
                                    type="text"
                                    value={otpCode}
                                    onChange={handleOtpChange}
                                    maxLength={6}
                                    className={otpError ? "invalid" : otpCode.length === 6 && !otpError ? "valid" : ""}
                                />
                                {otpCode.length === 6 && !otpError && otpVerified && (
                                    <i className="fa-solid fa-circle-check email-valid-icon"></i>
                                )}
                            </div>
                            {otpError && <p style={{ color: "red" }}>{otpError}</p>}
                        </div>
                    )}

                    <div className={`ticket-fields ${(!formData.emp_id || !otpVerified) ? "blurred" : ""}`}>

                        {otpVerified && (
                            <div className="issue-section">
                                <h3>Create Issue:</h3>

                                <div className="issue-type-row">
                                    <label className="issue-type-label">Issue Type:</label>
                                    <div className="issue-options">
                                        <label>
                                            <input
                                                type="radio"
                                                value="Bug"
                                                checked={issueType === "Bug"}
                                                onChange={(e) => {
                                                    const newType = e.target.value;
                                                    setIssueType(newType);

                                                    // Reset all dependent fields
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        issue_type: newType,
                                                        assignee: "Pavithran",
                                                        summary: "",
                                                        description: "", // Quill will handle default template
                                                        attachment: null,
                                                        priority: "",
                                                        team: "",
                                                        testingType: "",
                                                        devicesTested: [],
                                                    }));

                                                    // Clear file input
                                                    if (fileInputRef.current) fileInputRef.current.value = null;

                                                    // Set default template in Quill
                                                    if (bugQuill) {
                                                        bugQuill.root.innerHTML = `
          <p><strong>Steps to Reproduce:</strong><br>------------------------------------</p>
          <p><strong>Test Data:</strong><br>------------------------------------</p>
          <p><strong>Expected Result:</strong><br>------------------------------------</p>
          <p><strong>Actual Result:</strong><br>------------------------------------</p>
        `;
                                                    }
                                                    if (ideaQuill) {
                                                        ideaQuill.root.innerHTML = ""; // clear Idea editor for now
                                                    }
                                                }}
                                            />
                                            Bug
                                        </label>

                                        <label>
                                            <input
                                                type="radio"
                                                value="Idea"
                                                checked={issueType === "Idea"}
                                                onChange={(e) => {
                                                    const newType = e.target.value;
                                                    setIssueType(newType);

                                                    // Reset all dependent fields
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        issue_type: newType,
                                                        assignee: "Anand Sir",
                                                        summary: "",
                                                        description: "",
                                                        attachment: null,
                                                        priority: "",
                                                        team: "",
                                                        testingType: "",
                                                        devicesTested: [],
                                                    }));

                                                    // Clear file input
                                                    if (fileInputRef.current) fileInputRef.current.value = null;

                                                    // Set default template in Quill
                                                    if (ideaQuill) {
                                                        ideaQuill.root.innerHTML = `
          <p><strong>Steps to Reproduce:</strong><br>------------------------------------</p>
          <p><strong>Test Data:</strong><br>------------------------------------</p>
          <p><strong>Expected Result:</strong><br>------------------------------------</p>
          <p><strong>Actual Result:</strong><br>------------------------------------</p>
        `;
                                                    }
                                                    if (bugQuill) {
                                                        bugQuill.root.innerHTML = ""; // clear Bug editor for now
                                                    }
                                                }}
                                            />
                                            Idea
                                        </label>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Render both Quill editors but hide/show based on issueType */}
                        <div style={{ display: issueType === "Bug" ? "block" : "none" }}>
                            <label>Summary <span style={{ color: "red" }}>*</span></label>
                            <input type="text" name="summary" value={formData.summary} onChange={handleChange} />

                            <label>Description <span style={{ color: "red" }}>*</span></label>
                            <div ref={bugQuillRef} style={{ height: "150px", marginBottom: "20px" }} />

                            {/* Attachment */}
                            <div className="attachment-field" style={{ position: "relative", display: "inline-block", width: "100%" }}>
                                <label>Attachments</label>
                                <input
                                    type="file"
                                    name="attachments"
                                    ref={fileInputRef}
                                    multiple  // ✅ allow selecting multiple files
                                    onChange={handleFileChange}
                                    disabled={!formData.emp_id}
                                    style={{ width: "100%" }}
                                />

                                {/* Show file names + X icon */}
                                {formData.attachments && formData.attachments.length > 0 && (
                                    <div style={{ marginTop: "8px" }}>
                                        {formData.attachments.map((file, index) => (
                                            <div key={index} style={{ display: "flex", alignItems: "center", marginBottom: "5px" }}>
                                                <span>{file.name}</span>
                                                <FaTimes
                                                    style={{
                                                        marginLeft: "10px",
                                                        cursor: "pointer",
                                                        color: "gray",
                                                    }}
                                                    onClick={() => removeFile(index)}
                                                    title="Remove file"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                        </div>

                        <div style={{ display: issueType === "Idea" ? "block" : "none" }}>
                            <label>Summary <span style={{ color: "red" }}>*</span></label>
                            <input type="text" name="summary" value={formData.summary} onChange={handleChange} />

                            <label>Description <span style={{ color: "red" }}>*</span></label>
                            <div ref={ideaQuillRef} style={{ height: "150px", marginBottom: "20px" }} />

                            {/* Attachment */}
                            <div className="attachment-field" style={{ position: "relative", display: "inline-block", width: "100%" }}>
                                <label>Attachments</label>
                                <input
                                    type="file"
                                    name="attachments"
                                    ref={fileInputRef}
                                    multiple  // ✅ allow selecting multiple files
                                    onChange={handleFileChange}
                                    disabled={!formData.emp_id}
                                    style={{ width: "100%" }}
                                />

                                {/* Show file names + X icon */}
                                {formData.attachments && formData.attachments.length > 0 && (
                                    <div style={{ marginTop: "8px" }}>
                                        {formData.attachments.map((file, index) => (
                                            <div key={index} style={{ display: "flex", alignItems: "center", marginBottom: "5px" }}>
                                                <span>{file.name}</span>
                                                <FaTimes
                                                    style={{
                                                        marginLeft: "10px",
                                                        cursor: "pointer",
                                                        color: "gray",
                                                    }}
                                                    onClick={() => removeFile(index)}
                                                    title="Remove file"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {issueType === "Bug" && (
                            <div className="ticket-fields">
                                <label>Assignee</label>
                                <select disabled>
                                    <option selected>{issueType === "Bug" ? "Pavithran" : "Anand Sir"}</option>
                                </select>

                                <label>Priority <span style={{ color: "red" }}>* </span></label>

                                <div className="priority-custom-dropdown" ref={priorityRef}>
                                    <div className="selected-option" onClick={() => setShowPriority(prev => !prev)}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                            {formData.priority
                                                ? priorities.find(p => p.value === formData.priority).icon
                                                : null}
                                            {formData.priority
                                                ? priorities.find(p => p.value === formData.priority).label
                                                : "Select Priority"}
                                        </div>
                                        <i className="fa-solid fa-angle-down priority-arrow"></i>
                                    </div>

                                    {/* Dropdown list */}
                                    {showPriority && (
                                        <div className="priority-dropdown-menu">
                                            {priorities.map((p) => (
                                                <div
                                                    key={p.value}
                                                    className="priority-dropdown-item"
                                                    onClick={(e) => {
                                                        e.stopPropagation(); // Prevent toggle
                                                        handleChange({ target: { name: "priority", value: p.value } });
                                                        setShowPriority(false);
                                                    }}
                                                >
                                                    {p.icon} {p.label}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <label>Reporting Team</label>
                                <select name="team" onChange={handleChange}>
                                    <option>Dev Team</option>
                                    <option>QA Team</option>
                                    <option>Ops Team</option>
                                </select>

                                <label>Testing Type</label>
                                <select name="testingType" onChange={handleChange}>
                                    <option>Manual</option>
                                    <option>Automation</option>
                                </select>

                                <label>Device Tested</label>
                                <Select
                                    isMulti
                                    name="devicesTested"
                                    options={deviceOptions}
                                    className="basic-multi-select"
                                    classNamePrefix="select"
                                    value={deviceOptions.filter(opt => formData.devicesTested?.includes(opt.value))}
                                    onChange={(selected) =>
                                        setFormData(prev => ({ ...prev, devicesTested: selected.map(opt => opt.value) }))
                                    }
                                />

                                <button type="submit" disabled={isSubmitting} className="submit-btn">
                                    {isSubmitting ? "Submitting..." : "Submit"}
                                </button>

                                <p className="ticket-note">
                                    <span className="note-title">Note:</span>

                                    <div className="note-row">
                                        <span className="note-index">1.</span>
                                        <span className="note-content">
                                            Once submitted, your defect will be routed to the respective development team.
                                            We appreciate your patience as per SLA window.
                                        </span>
                                    </div>

                                    <div className="note-row">
                                        <span className="note-index">2.</span>
                                        <span className="note-content">
                                            SLA: Low = &lt;48 hrs, Medium = &lt;24 hrs, High = &lt;8 hrs (Business Hours)
                                            <span className="note-icon-text">
                                                <i className="fa-solid fa-circle-exclamation"></i> Inappropriate priority will be deprioritized to max ETA.
                                            </span>
                                        </span>
                                    </div>
                                </p>
                            </div>
                        )}


                        {issueType === "Idea" && (
                            <div className="ticket-fields">
                                <label>Assignee</label>
                                <select disabled>
                                    <option selected>{issueType === "Bug" ? "Pavithran" : "Anand Sir"}</option>
                                </select>

                                <label>Reporting Team</label>
                                <select name="team" onChange={handleChange}>
                                    <option>Dev Team</option>
                                    <option>QA Team</option>
                                    <option>Ops Team</option>
                                </select>

                                <button type="submit" disabled={isSubmitting} className="submit-btn">
                                    {isSubmitting ? "Submitting..." : "Submit"}
                                </button>

                                <p className="ticket-note">
                                    <span className="note-title">Note:</span>

                                    <div className="note-row">
                                        <span className="note-content">
                                            Once submitted, your idea will be routed to the respective development team.
                                            We appreciate your patience during our review.
                                        </span>
                                    </div>
                                </p>
                            </div>
                        )}

                    </div>
                </form>
            </div>
        </div>
    );
};

export default Tickets;
