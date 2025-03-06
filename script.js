class BrowserResumeExtractor {
    constructor() {
        this.fileQueue = []; // Queue for uploaded files
        this.loadingElement = document.getElementById('loading'); // Loading spinner
        this.dropZone = document.getElementById('dropZone'); // Drag-and-drop area
        this.fileInput = document.getElementById('fileInput'); // File input element
        this.startBtn = document.getElementById('startBtn'); // Start processing button
        this.exportBtn = document.getElementById('exportBtn'); // Export to Excel button
        this.fileCounter = document.getElementById('fileCounter'); // File counter display
        this.errorMessage = document.getElementById('errorMessage'); // Error message display
        this.resultsBody = document.getElementById('resultsBody'); // Table body for results

        this.setupEventListeners(); // Initialize event listeners
    }

    setupEventListeners() {
        // Drag-and-drop handling
        this.dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.dropZone.classList.add('drop-zone--over');
        });

        this.dropZone.addEventListener('dragleave', () => {
            this.dropZone.classList.remove('drop-zone--over');
        });

        this.dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.dropZone.classList.remove('drop-zone--over');
            this.addToQueue(e.dataTransfer.files);
        });

        // File input handling
        this.fileInput.addEventListener('change', (e) => {
            this.addToQueue(e.target.files);
            e.target.value = ''; // Reset input
        });

        // Start processing button
        this.startBtn.addEventListener('click', async () => {
            if (this.fileQueue.length === 0) {
                this.showError('Please upload files first!');
                return;
            }
            await this.processQueue();
        });

        // Export to Excel button
        this.exportBtn.addEventListener('click', () => {
            this.exportToExcel();
        });
    }

    addToQueue(files) {
        this.fileQueue.push(...files); // Add files to the queue
        this.updateFileCounter(); // Update the file counter
        this.showError(''); // Clear any previous errors
    }

    updateFileCounter() {
        this.fileCounter.textContent = `Files queued: ${this.fileQueue.length}`;
    }

    async processQueue() {
        this.showLoading(true); // Show loading spinner
        try {
            while (this.fileQueue.length > 0) {
                const file = this.fileQueue.shift(); // Process the first file in the queue
                await this.processFile(file);
                this.updateFileCounter(); // Update the file counter
            }
        } catch (error) {
            console.error('Processing error:', error);
            this.showError(`Error processing file: ${error.message}`);
        }
        this.showLoading(false); // Hide loading spinner
    }

    async processFile(file) {
        try {
            const text = await this.extractText(file); // Extract text from the file
            const info = this.extractInfo(text, file.name); // Extract information from the text
            this.displayResult(info); // Display the result in the table
        } catch (error) {
            console.error(`Error processing ${file.name}:`, error);
            this.showError(`Failed to process ${file.name}: ${error.message}`);
        }
    }

    async extractText(file) {
        if (file.type === "application/pdf") {
            return this.extractFromPDF(file); // Extract text from PDF
        } else if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
            return this.extractFromDOCX(file); // Extract text from DOCX
        } else if (file.type.startsWith("image/")) {
            return this.extractFromImage(file); // Extract text from images using OCR
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
        const phones = text.match(/\+?\d[\d -]{7,}\d/g); // Match phone numbers
        return phones ? phones[0].trim() : "Not Found";
    }

    extractEmail(text) {
        const emails = text.match(/\b[\w\.-]+@[\w\.-]+\.\w{2,4}\b/g); // Match emails
        return emails ? emails[0] : "Not Found";
    }

    extractPosition(text) {
        const positionKeywords = [
            "engineer", "manager", "analyst", "developer", "specialist",
            "executive", "associate", "director", "officer", "coordinator"
        ];
        const pattern = new RegExp(
            `\\b([A-Z][a-z]+(?:\\s+[A-Za-z]+)*\\s+(${positionKeywords.join('|')})\\b`,
            "gi"
        );
        const matches = text.match(pattern);
        return matches ? matches[0].trim().replace(/\s{2,}/g, ' ') : "Not Found";
    }

    extractCompany(text) {
        const patterns = [
            "sdn\\s?bhd", "berhad", "corp", "enterprise",
            "technologies", "group", "global"
        ];
        const pattern = new RegExp(
            `\\b([A-Za-z]+(?:\\s+[A-Za-z]+){1,3}\\s*(?:${patterns.join('|')})?\\b`,
            "gi"
        );
        const matches = text.match(pattern);
        return matches ? matches[0].toUpperCase() : "Not Found";
    }

    displayResult(info) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${info.file}</td>
            <td>${info.name}</td>
            <td>${info.phone}</td>
            <td>${info.email}</td>
            <td>${info.position}</td>
            <td>${info.company}</td>
        `;
        this.resultsBody.appendChild(row);
    }

    exportToExcel() {
        const rows = Array.from(document.querySelectorAll('#resultsBody tr'));
        if (rows.length === 0) {
            this.showError('No data to export!');
            return;
        }

        const data = rows.map(row => ({
            File: row.cells[0].textContent,
            Name: row.cells[1].textContent,
            Phone: row.cells[2].textContent,
            Email: row.cells[3].textContent,
            Position: row.cells[4].textContent,
            Company: row.cells[5].textContent
        }));

        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Resumes');
        XLSX.writeFile(workbook, 'resume_data.xlsx');
    }

    showError(message) {
        this.errorMessage.textContent = message;
        this.errorMessage.style.display = message ? 'block' : 'none';
    }

    showLoading(show) {
        this.loadingElement.style.display = show ? 'block' : 'none';
        this.startBtn.disabled = show;
    }
}

// Initialize the app
const extractor = new BrowserResumeExtractor();
