class BrowserResumeExtractor {
    constructor() {
        this.results = [];
    }

    async processFile(file) {
        const text = await this.extractText(file);
        const info = this.extractInfo(text, file.name);
        this.displayResult(info);
    }

    async extractText(file) {
        if (file.type === "application/pdf") {
            return this.extractFromPDF(file);
        } else if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
            return this.extractFromDOCX(file);
        } else if (file.type.startsWith("image/")) {
            return this.extractFromImage(file);
        } else {
            throw new Error("Unsupported file type");
        }
    }

    async extractFromPDF(file) {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument(arrayBuffer);
        const pdf = await loadingTask.promise;
        let text = "";

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            text += content.items.map((item) => item.str).join(" ");
        }
        return text;
    }

    async extractFromDOCX(file) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
        return result.value;
    }

    async extractFromImage(file) {
        const worker = Tesseract.createWorker();
        await worker.load();
        await worker.loadLanguage("eng");
        await worker.initialize("eng");

        const { data: { text } } = await worker.recognize(file);
        await worker.terminate();
        return text;
    }

    extractInfo(text, filename) {
        return {
            file: filename,
            name: this.extractName(filename),
            phone: this.extractPhone(text),
            email: this.extractEmail(text),
            position: this.extractPosition(text),
            company: this.extractCompany(text),
        };
    }

    extractName(filename) {
        const cleanName = filename.replace(/\.[^/.]+$/, ""); // Remove file extension
        return cleanName
            .split(/[-_]/)
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(" ");
    }

    extractPhone(text) {
        const phones = text.match(/\+?\d[\d -]{7,}\d/g);
        return phones ? phones[0].trim() : "Not Found";
    }

    extractEmail(text) {
        const emails = text.match(/\b[\w\.-]+@[\w\.-]+\.\w{2,4}\b/g);
        return emails ? emails[0] : "Not Found";
    }

    extractPosition(text) {
        const positionKeywords = [
            "engineer",
            "manager",
            "analyst",
            "developer",
            "specialist",
            "executive",
            "associate",
            "director",
        ];
        const positionPattern = new RegExp(
            `\\b([A-Z][a-z]+(?:\\s+[A-Z][a-z]+)*\\s+(?:${positionKeywords.join("|")})\\b`,
            "gi"
        );
        const matches = text.match(positionPattern);
        return matches ? matches[0].trim() : "Not Found";
    }

    extractCompany(text) {
        const companyPatterns = [
            "sdn\\s?bhd",
            "berhad",
            "bhd",
            "corp",
            "enterprise",
            "group",
            "global",
            "tech",
            "solutions",
        ];
        const companyPattern = new RegExp(
            `\\b([A-Za-z]+(?:\\s+[A-Za-z]+)*\\s*(?:${companyPatterns.join("|")}))\\b`,
            "gi"
        );
        const matches = text.match(companyPattern);
        return matches ? matches[0].trim().toUpperCase() : "Not Found";
    }

    displayResult(info) {
        const tableBody = document.querySelector("#results tbody");
        const row = document.createElement("tr");

        Object.values(info).forEach((value) => {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
        });

        tableBody.appendChild(row);
    }
}

// Initialize the extractor and handle file input
const extractor = new BrowserResumeExtractor();
document.getElementById("fileInput").addEventListener("change", async (e) => {
    const files = Array.from(e.target.files);
    for (const file of files) {
        await extractor.processFile(file);
    }
});