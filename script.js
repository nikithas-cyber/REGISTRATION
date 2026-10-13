
const complaintForm = document.getElementById("complaintForm");
const trackingForm = document.getElementById("trackingForm");
const submitBtn = document.getElementById("submitBtn");
const trackBtn = document.getElementById("trackBtn");
const formMessage = document.getElementById("formMessage");
const trackingResult = document.getElementById("trackingResult");

async function sendRequest(url, options = {}) {
    const response = await fetch(url, options);
    const text = await response.text();

    let result;

    try {
        result = JSON.parse(text);
    } catch {
        throw new Error(
            text.trim()
                ? "Server returned an invalid response."
                : "Empty response from server. Check backend/server.js."
        );
    }

    if (!response.ok) {
        throw new Error(result.message || "Request failed.");
    }

    return result;
}

function addText(parent, label, value) {
    const p = document.createElement("p");
    const strong = document.createElement("strong");

    strong.textContent = label + ": ";
    p.append(strong, document.createTextNode(value ?? "Not provided"));
    parent.appendChild(p);
}

function addEvidence(card, label, url, type) {
    if (!url) return;

    const heading = document.createElement("h4");
    heading.textContent = label;
    card.appendChild(heading);

    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.className = "evidence-link";
    link.textContent = "Open " + label;
    card.appendChild(link);

    if (type === "image" || type === "audio" || type === "video") {
        const media = document.createElement(
            type === "image" ? "img" : type
        );

        media.src = url;
        media.className = "evidence-preview";
        media.controls = type !== "image";

        if (type === "image") {
            media.alt = "Uploaded complaint evidence";
        } else {
            media.preload = "metadata";
        }

        card.appendChild(media);
    }
}

complaintForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(complaintForm);
    const documents = document.getElementById("documents").files;

    if (documents.length > 5) {
        formMessage.textContent = "You can upload a maximum of 5 documents.";
        return;
    }

    submitBtn.disabled = true;
    formMessage.textContent = "Submitting complaint and uploading evidence...";

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

complaintForm.addEventListener("reset", () => {
    formMessage.textContent = "";
});

trackingForm.addEventListener("submit", async (event) => {
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
            ["Description", complaint.description],
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
            addText(card, label, value);
        });

        addEvidence(card, "Uploaded Image", complaint.image_path, "image");
        addEvidence(card, "Audio Explanation", complaint.audio_path, "audio");
        addEvidence(card, "Problem Video", complaint.video_path, "video");

        let documents = [];

        try {
            documents = complaint.documents_path
                ? JSON.parse(complaint.documents_path)
                : [];
        } catch {
            documents = [];
        }

        if (Array.isArray(documents)) {
            documents.forEach((url, index) => {
                addEvidence(
                    card,
                    `Supporting Document ${index + 1}`,
                    url,
                    "document"
                );
            });
        }

        trackingResult.replaceChildren(card);
    } catch (error) {
        console.error("Tracking error:", error);
        trackingResult.textContent = error.message;
    } finally {
        trackBtn.disabled = false;
    }
});
