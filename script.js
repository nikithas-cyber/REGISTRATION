const complaintForm = document.getElementById("complaintForm");
const trackingForm = document.getElementById("trackingForm");
const submitBtn = document.getElementById("submitBtn");
const trackBtn = document.getElementById("trackBtn");
const formMessage = document.getElementById("formMessage");
const trackingResult = document.getElementById("trackingResult");


async function sendRequest(url, options) {
    const response = await fetch(url, options);
    const responseText = await response.text();

    console.log("URL:", url);
    console.log("Status:", response.status);
    console.log("Response:", responseText);

    if (!responseText.trim()) {
        throw new Error(
            "Empty response from server. Check backend/server.js."
        );
    }

    let result;

    try {
        result = JSON.parse(responseText);
    } catch {
        throw new Error(
            "Invalid JSON response: " + responseText.slice(0, 200)
        );
    }

    if (!response.ok) {
        throw new Error(result.message || "Request failed.");
    }

    return result;
}


complaintForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const formData = new FormData(complaintForm);

    const complaint = {
        name: formData.get("name").trim(),
        email: formData.get("email").trim(),
        phone: formData.get("phone").trim(),
        customer_id: formData.get("customer_id").trim(),
        category: formData.get("category"),
        service: formData.get("service"),
        title: formData.get("title").trim(),
        description: formData.get("description").trim(),
        priority: formData.get("priority"),
        address: formData.get("address").trim(),
        city: formData.get("city").trim(),
        state: formData.get("state"),
        pincode: formData.get("pincode").trim(),
        date: formData.get("date"),
        time: formData.get("time"),
        website: formData.get("website").trim(),
        satisfaction: Number(formData.get("satisfaction")),
        color: formData.get("color"),
        updates: formData.has("updates"),
        terms: formData.has("terms")
    };

    submitBtn.disabled = true;
    formMessage.textContent = "Submitting complaint...";

    try {
        const result = await sendRequest("/submit-complaint", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(complaint)
        });

        formMessage.textContent =
            `${result.message} Complaint ID: ${result.complaintId}`;

        document.getElementById("complaintId").value =
            result.complaintId;

        complaintForm.reset();
    } catch (error) {
        console.error("Submission error:", error);
        formMessage.textContent = error.message;
    } finally {
        submitBtn.disabled = false;
    }
});

complaintForm.addEventListener("reset", function () {
    formMessage.textContent = "";
});

trackingForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const id = document.getElementById("complaintId").value.trim();

    trackingResult.replaceChildren();

    if (!id || !Number.isSafeInteger(Number(id)) || Number(id) < 1) {
        trackingResult.textContent = "Enter a valid Complaint ID.";
        return;
    }

    trackBtn.disabled = true;
    trackingResult.textContent = "Searching for your complaint...";

    try {
        const complaint = await sendRequest(
            `/track-complaint/${encodeURIComponent(id)}`
        );

        const card = document.createElement("div");
        card.className = "result-card";

        const heading = document.createElement("h3");
        heading.textContent = "Complaint Details";
        card.appendChild(heading);

        const details = [
            ["Complaint ID", complaint.id],
            ["Name", complaint.name],
            ["Category", complaint.category],
            ["Service", complaint.service],
            ["Title", complaint.title],
            ["Priority", complaint.priority],
            ["Status", complaint.status],
            [
                "Submitted",
                complaint.created_at
                    ? new Date(complaint.created_at).toLocaleString()
                    : "Not available"
            ]
        ];

        details.forEach(([label, value]) => {
            const paragraph = document.createElement("p");
            const strong = document.createElement("strong");

            strong.textContent = `${label}: `;
            paragraph.appendChild(strong);
            paragraph.appendChild(
                document.createTextNode(value ?? "Not provided")
            );

            card.appendChild(paragraph);
        });

        trackingResult.replaceChildren(card);
    } catch (error) {
        console.error("Tracking error:", error);
        trackingResult.textContent = error.message;
    } finally {
        trackBtn.disabled = false;
    }
});