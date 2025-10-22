import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./Thank_you.css";

const ThankYou = () => {
    const location = useLocation();
    const navigate = useNavigate();

    const { employeeName, ticketId } = location.state || {};

    return (
        <div className="thankyou-container">
            <h1>🎉Submitted!</h1>
            <p>
                Thank you, <strong>{employeeName}</strong>! <br />
                Your ticket has been submitted successfully.
            </p>
            <p>
                <strong>Ticket ID:</strong> {ticketId}
            </p>
            <p>You will receive updates via email shortly.</p>

            <button
                className="thankyou-button"
                onClick={() => navigate("/Tickets")}
            >
                Raise Another Ticket
            </button>
        </div>
    );
};

export default ThankYou;
