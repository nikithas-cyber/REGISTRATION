
const complaintForm = document.getElementById("complaintForm");
const trackingForm = document.getElementById("trackingForm");

const submitBtn = document.getElementById("submitBtn");
const trackBtn = document.getElementById("trackBtn");

const formMessage = document.getElementById("formMessage");
const trackingResult = document.getElementById("trackingResult");

// Send a request and read the JSON response.
async function sendRequest(url, options = {}) {
    const response = await fetch(url, options);
    const responseText = await response.text();

    console.log("URL:", url);
    console.log("Status:", response.status);
    console.log("Response:", responseText);

    if (!responseText.trim()) {
        throw new Error(
            `Empty response from server. HTTP ${response.status}`
        );
    }

    let result;

    try {
        result = JSON.parse(responseText);
    } catch {
        throw new Error(
            "Invalid server response: " + responseText.slice(0, 200)
        );
    }

    if (!response.ok) {
        throw new Error(result.message || "Request failed.");
    }

    return result;
}

// Submit complaint details and uploaded files.
if (complaintForm) {
    complaintForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        if (!complaintForm.reportValidity()) {
            return;
        }

        // FormData includes text fields, checkboxes and file inputs.
        const formData = new FormData(complaintForm);

        // Ensure checkbox values are explicitly sent as true/false.
        formData.set(
            "updates",
            document.getElementById("updates").checked ? "true" : "false"
        );

        formData.set(
            "terms",
            document.getElementById("terms").checked ? "true" : "false"
        );

        submitBtn.disabled = true;
        formMessage.textContent = "Submitting complaint...";

        try {
            const result = await sendRequest("/submit-complaint", {
                method: "POST",
                body: formData
            });

            // Do NOT add a Content-Type header manually.
            // The browser sets multipart/form-data with its boundary.

            formMessage.textContent =
                `${result.message} Complaint ID: ${result.complaintId}`;

            const complaintIdInput =
                document.getElementById("complaintId");

            if (complaintIdInput) {
                complaintIdInput.value = result.complaintId;
            }

            // Clear fields only after successful submission.
            complaintForm.reset();

        } catch (error) {
            console.error("Submission error:", error);
            formMessage.textContent = error.message;
        } finally {
            submitBtn.disabled = false;
        }
    });
}

// Track an existing complaint by its ID.
if (trackingForm) {
    trackingForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const complaintId =
            document.getElementById("complaintId").value.trim();

        if (!/^[1-9]\d*$/.test(complaintId)) {
            trackingResult.textContent =
                "Please enter a valid Complaint ID.";
            return;
        }

        trackBtn.disabled = true;
        trackingResult.textContent = "Searching for your complaint...";

        try {
            const result = await sendRequest(
                `/track-complaint/${encodeURIComponent(complaintId)}`
            );

            // Display complaint details safely.
            trackingResult.replaceChildren();

            const card = document.createElement("div");
            card.className = "result-card";

            const fields = [
                ["Complaint ID", result.id],
                ["Customer Name", result.name],
                ["Email", result.email],
                ["Phone", result.phone],
                ["Category", result.category],
                ["Service", result.service],
                ["Title", result.title],
                ["Description", result.description],
                ["Priority", result.priority],
                ["Address", result.address],
                ["City", result.city],
                ["State", result.state],
                ["Pincode", result.pincode],
                ["Preferred Date", result.preferred_date],
                ["Preferred Time", result.preferred_time],
                ["Website", result.website],
                ["Expected Service Quality", result.satisfaction],
                ["Preferred Color", result.preferred_color],
                ["Receive Updates", result.updates],
                ["Status", result.status],
                ["Created At", result.created_at]
            ];

            for (const [label, value] of fields) {
                if (value === null || value === undefined || value === "") {
                    continue;
                }

                const paragraph = document.createElement("p");
                const strong = document.createElement("strong");

                strong.textContent = label + ": ";
                paragraph.appendChild(strong);
                paragraph.appendChild(
                    document.createTextNode(String(value))
                );

                card.appendChild(paragraph);
            }

            // Show attachment links when files are available.
            const attachments = [
                ["Image", result.image_path],
                ["Audio", result.audio_path],
                ["Video", result.video_path],
                ["Documents", result.document_path]
            ];

            for (const [label, rawPaths] of attachments) {
                if (!rawPaths) continue;

                let paths;

                try {
                    paths = Array.isArray(rawPaths)
                        ? rawPaths
                        : JSON.parse(rawPaths);
                } catch {
                    paths = [rawPaths];
                }

                if (!Array.isArray(paths)) {
                    paths = [paths];
                }

                for (const filePath of paths) {
                    if (
                        typeof filePath !== "string" ||
                        !filePath.startsWith("/uploads/") ||
                        filePath.includes("..")
                    ) {
                        continue;
                    }

                    const paragraph = document.createElement("p");
                    const link = document.createElement("a");

                    link.href = filePath;
                    link.textContent = "View " + label;
                    link.target = "_blank";
                    link.rel = "noopener noreferrer";

                    paragraph.appendChild(link);
                    card.appendChild(paragraph);
                }
            }

            trackingResult.appendChild(card);

        } catch (error) {
            console.error("Tracking error:", error);
            trackingResult.textContent = error.message;
        } finally {
            trackBtn.disabled = false;
        }
    });
}
