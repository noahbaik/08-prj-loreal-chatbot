/* DOM elements */
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");

// Replace this URL with the actual Cloudflare Worker URL you deploy.
const workerUrl = "https://loreal-api-key.noahbaik.workers.dev/";

// This system prompt guides the chatbot to stay focused on L'Oréal topics.
const systemPrompt = `You are a helpful L'Oréal beauty assistant. Only answer questions about L'Oréal products, routines, skincare, makeup, haircare, fragrances, and recommendations. If the user asks about anything outside L'Oréal beauty, politely say you can only help with L'Oréal products and routines. Keep answers clear, concise, and friendly.`;

const storageKey = "loreal-chat-context";
let conversationMessages = [];
let userName = "";

function loadSavedContext() {
  try {
    const savedContext = localStorage.getItem(storageKey);
    if (!savedContext) {
      return {
        messages: [{ role: "system", content: systemPrompt }],
        userName: "",
      };
    }

    const parsed = JSON.parse(savedContext);
    return {
      messages: parsed.messages?.length
        ? parsed.messages
        : [{ role: "system", content: systemPrompt }],
      userName: parsed.userName || "",
    };
  } catch (error) {
    console.error("Could not load saved chat context.", error);
    return {
      messages: [{ role: "system", content: systemPrompt }],
      userName: "",
    };
  }
}

function saveContext() {
  try {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        messages: conversationMessages,
        userName,
      }),
    );
  } catch (error) {
    console.error("Could not save chat context.", error);
  }
}

function addMessage(text, role) {
  const message = document.createElement("div");
  message.className = `msg ${role}`;
  message.textContent = text;
  chatWindow.appendChild(message);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function rememberUserDetails(messageText) {
  if (!userName) {
    const nameMatch = messageText.match(/my name is ([a-zA-ZÀ-ÿ' -]+)/i);
    if (nameMatch) {
      userName = nameMatch[1].trim();
      return `Thanks, ${userName}! I’ll remember your name for this chat.`;
    }
  }
  return "";
}

function showWelcomeMessage() {
  if (conversationMessages.length === 1) {
    addMessage(
      "👋 Hello! Ask me about L'Oréal skincare, makeup, haircare, fragrances, or routines. I’ll remember your name and earlier questions in this chat.",
      "ai",
    );
  }
}

const savedContext = loadSavedContext();
conversationMessages = savedContext.messages;
userName = savedContext.userName;
showWelcomeMessage();

/* Handle form submit */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const messageText = userInput.value.trim();
  if (!messageText) {
    return;
  }

  const nameReminder = rememberUserDetails(messageText);

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
    // Save the new user message so the next reply can use earlier context.
    conversationMessages.push({ role: "user", content: messageText });
    saveContext();

    // Build a request that includes the full chat history.
    const requestMessages = [...conversationMessages];
    if (userName) {
      requestMessages[0] = {
        role: "system",
        content: `${systemPrompt}\nThe user's name is ${userName}. Use it naturally if helpful.`,
      };
    }

    // Send the conversation to the Cloudflare Worker.
    // The worker sends the request to OpenAI's Chat Completions API.
    const response = await fetch(workerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: requestMessages,
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

    conversationMessages.push({ role: "assistant", content: reply });
    saveContext();

    // Remove the loading text and show the assistant response.
    chatWindow.removeChild(loadingMessage);
    if (nameReminder) {
      addMessage(nameReminder, "ai");
    }
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
