/* DOM elements */
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");

// Replace this URL with the actual Cloudflare Worker URL you deploy.
const workerUrl = "https://loreal-api-key.noahbaik.workers.dev/";

// This system prompt guides the chatbot to stay focused on L'Oréal topics.
const systemPrompt = `You are a helpful L'Oréal beauty assistant. Only answer questions about L'Oréal products, routines, skincare, makeup, haircare, fragrances, and recommendations. If the user asks about anything outside L'Oréal beauty, politely say you can only help with L'Oréal products and routines. Keep answers clear, concise, and friendly.`;

function addMessage(text, role) {
  const message = document.createElement("div");
  message.className = `msg ${role}`;
  message.textContent = text;
  chatWindow.appendChild(message);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function showWelcomeMessage() {
  addMessage(
    "👋 Hello! Ask me about L'Oréal skincare, makeup, haircare, fragrances, or routines.",
    "ai",
  );
}

showWelcomeMessage();

/* Handle form submit */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const messageText = userInput.value.trim();
  if (!messageText) {
    return;
  }

  // Show the user's message in the chat window.
  addMessage(messageText, "user");
  userInput.value = "";

  // Disable the form while waiting for the reply.
  const sendButton = chatForm.querySelector("button");
  userInput.disabled = true;
  sendButton.disabled = true;

  // Show a short loading message.
  const loadingMessage = document.createElement("div");
  loadingMessage.className = "msg ai";
  loadingMessage.textContent = "Thinking...";
  chatWindow.appendChild(loadingMessage);
  chatWindow.scrollTop = chatWindow.scrollHeight;

  try {
    // Send the conversation to the Cloudflare Worker.
    // The worker sends the request to OpenAI's Chat Completions API.
    const response = await fetch(workerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: messageText },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      throw new Error(
        data.error?.message || "The worker could not complete the request.",
      );
    }

    const reply =
      data.choices?.[0]?.message?.content ||
      "Sorry, I could not generate a reply right now.";

    // Remove the loading text and show the assistant response.
    chatWindow.removeChild(loadingMessage);
    addMessage(reply, "ai");
  } catch (error) {
    chatWindow.removeChild(loadingMessage);
    addMessage(
      `Sorry, the chatbot could not answer right now. ${error.message}`,
      "ai",
    );
    console.error(error);
  } finally {
    userInput.disabled = false;
    sendButton.disabled = false;
    userInput.focus();
  }
});
