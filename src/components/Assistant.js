import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/legacy/build/pdf.worker.entry'; // Import the worker
import '/Users/abhiwrld/estabeta/src/styles/Assistant.css'; // Assuming you have styles in this file

// Configure PDF.js to use the imported worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const Assistant = () => {
    const [conversation, setConversation] = useState([]);
    const [input, setInput] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [fileContents, setFileContents] = useState([]);

    const systemLikeMessage = {
        role: 'user',
        content: 'You are a highly advanced AI legal assistant designed to help lawyers enhance their research, draft contracts, prepare cases, and improve their overall efficiency as per Indian Law. Your primary responsibilities include: Legal Research: Provide accurate and up-to-date information on laws, regulations, case law, and legal precedents. Additionally, utilize the information from the three supplementary files provided to offer insights beyond the cutoff date. Document Drafting: Assist in drafting legal documents such as contracts, briefs, memos, and motions, ensuring they adhere to proper legal standards and terminology. Case Preparation: Offer insights on legal strategies, analyze case details, and help organize case materials. Professional Communication: Communicate in a clear, precise, and professional manner appropriate for legal professionals. You also have to cite relevant sources or any sections/acts that you will use as per indian law and constitution/ipc/bns.'
    }

    useEffect(() => {
        setConversation([systemLikeMessage]);
    }, []);

    const demoPrompts = [
        'What are the key elements of a contract?',
        'Explain the implications of a breach of contract.',
        'What is the process for filing a lawsuit?',
        'How can I draft a non-disclosure agreement (NDA)?',
    ];

    const readTxtFile = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
            reader.readAsText(file);
        });
    };

    const readPdfFile = async (file) => {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdfData = new Uint8Array(arrayBuffer);
            const pdfDoc = await pdfjsLib.getDocument({ data: pdfData }).promise;
            let text = '';

            for (let i = 0; i < pdfDoc.numPages; i++) {
                const page = await pdfDoc.getPage(i + 1);
                const textContent = await page.getTextContent();
                text += textContent.items.map((item) => item.str).join(' ') + '\n';
            }
            return text;
        } catch (err) {
            console.error('PDF processing error:', err);
            throw new Error(`Error processing PDF: ${file.name}`);
        }
    };

    const handleFileUpload = async (event) => {
        const files = event.target.files;
        if (!files) return;

        setError('');
        const newFileContents = [];

        try {
            for (const file of files) {
                const fileExtension = file.name.split('.').pop().toLowerCase();

                if (fileExtension === 'txt') {
                    const content = await readTxtFile(file);
                    newFileContents.push(content);
                } else if (fileExtension === 'pdf') {
                    const content = await readPdfFile(file);
                    newFileContents.push(content);
                } else {
                    setError('Unsupported file type. Please upload .txt or .pdf files.');
                    return;
                }
            }

            setFileContents((prev) => [...prev, ...newFileContents]);
        } catch (err) {
            console.error('File upload error:', err);
            setError(err.message);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const userMessage = { role: 'user', content: input };
        setConversation((prev) => [...prev, userMessage]); // Update chat window with user's message immediately

        try {
            const apiKey = process.env.REACT_APP_OPENAI_API_KEY;
            const model = fileContents.length > 0 ? "gpt-4o-mini" : "o1-preview";
            const requestBody = {
                model,
                messages: [
                    systemLikeMessage,
                    ...conversation.slice(1),
                    userMessage,
                    ...(fileContents.length > 0
                        ? [{ role: 'user', content: `Uploaded file contents: ${fileContents.join('\n')}` }]
                        : []),
                ],
                temperature: fileContents.length > 0 ? 0.7 : 1,
            };

            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify(requestBody),
            });

            if (res.ok) {
                const data = await res.json();
                const assistantMessage = data.choices[0].message;
                setConversation((prev) => [...prev, assistantMessage]);
            } else {
                const errorData = await res.json();
                setError(`Error: ${errorData.error?.message || 'Unable to process your request.'}`);
            }
        } catch (err) {
            console.error('API error:', err);
            setError('An error occurred while connecting to the OpenAI API.');
        } finally {
            setLoading(false);
            setInput(''); // Clear input after submission
        }
    };

    return (
        <div className="resonance-container">
            <h1 className="title">Estavel Law - Legal AI Assistant</h1>
            <div className="chat-window">
                {conversation
                .filter((message, index) => index !== 0)
                .map((message, index) => (
                    <div key={index} className={`message ${message.role}`}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                    </div>
                ))}
                {loading && (
                    <div className="message assistant typing-indicator">
                        <p>Thinking<span className="dot1">.</span><span className="dot2">.</span><span className="dot3">.</span></p>
                    </div>
                )}
            </div>

            <form onSubmit={handleSubmit} className="chat-form">
                <div className="file-upload">
                    <label htmlFor="file-input">📎</label>
                    <input
                        id="file-input"
                        type="file"
                        accept=".txt,.pdf"
                        multiple
                        onChange={handleFileUpload}
                        disabled={loading}
                    />
                </div>
                <input
                    type="text"
                    placeholder="Message Estavel Law..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    disabled={loading}
                />
                <button type="submit" disabled={loading || !input.trim()}>
                    {loading ? '...' : 'Send'}
                </button>
            </form>

            <div className="demo-prompts">
                {demoPrompts.map((prompt, index) => (
                    <div key={index} className="prompt" onClick={() => setInput(prompt)}>
                        {prompt}
                    </div>
                ))}
            </div>

            {error && <div className="error">{error}</div>}
        </div>
    );
};

export default Assistant;
