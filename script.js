
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
        throw new Error("Empty response from server. Check backend/server.js.");
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

formData.delete("audio");
formData.delete("video");
formData.delete("documents");

    submitBtn.disabled = true;
    formMessage.textContent = "Submitting complaint...";

    try {
        const result = await sendRequest("/submit-complaint", {
            method: "POST",
            body: formData
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

        if (complaint.image_path) {
            const imageHeading = document.createElement("h4");
            imageHeading.textContent = "Uploaded Complaint Image";
            card.appendChild(imageHeading);

            const image = document.createElement("img");
            image.src = complaint.image_path;
            image.alt = "Uploaded complaint evidence";
            image.style.maxWidth = "250px";
            image.style.width = "100%";
            image.style.height = "auto";
            image.style.borderRadius = "10px";
            image.style.marginTop = "10px";

            image.onerror = function () {
                image.alt = "Unable to load the uploaded image.";
            };

            card.appendChild(image);
        }

        trackingResult.replaceChildren(card);
    } catch (error) {
        console.error("Tracking error:", error);
        trackingResult.textContent = error.message;
    } finally {
        trackBtn.disabled = false;
    }
});
