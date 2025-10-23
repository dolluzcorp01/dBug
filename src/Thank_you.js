import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./Thank_you.css";

const ThankYou = () => {
    const location = useLocation();
    const navigate = useNavigate();

    const { employeeName, ticketId, issueType } = location.state || {};

    const lowerIssue = issueType ? issueType.toLowerCase() : "ticket";

    return (
        <div className="thankyou-container">
            <h1>🎉 Submitted!</h1>
            <p>
                Thank you, <strong>{employeeName}</strong>! <br />
                Your {lowerIssue} has been submitted successfully.
            </p>
            <p>
                <strong>{issueType} ID:</strong> {ticketId}
            </p>
            <p>You will receive updates via email shortly.</p>

            <button
                className="thankyou-button"
                onClick={() => navigate("/Tickets")}
            >
                Raise Another {issueType}
            </button>
        </div>
    );
};

export default ThankYou;
