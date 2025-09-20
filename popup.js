document.addEventListener('DOMContentLoaded', () => {
  const submitButton = document.getElementById('submit-button');
  const promptInput = document.getElementById('prompt-input');
  const resultContainer = document.getElementById('result-container');
  const statusContainer = document.getElementById('status-container');

  submitButton.addEventListener('click', () => {
    const prompt = promptInput.value.trim();

    if (prompt) {
      statusContainer.textContent = 'Thinking...';
      resultContainer.textContent = '';

      chrome.runtime.sendMessage({ action: 'processPrompt', prompt: prompt }, (response) => {
        if (chrome.runtime.lastError) {
          statusContainer.textContent = 'Error: Could not connect.';
          console.error(chrome.runtime.lastError);
          return;
        }

        if (response.status === 'Result') {
          resultContainer.textContent = response.data;
          statusContainer.textContent = 'Done!';
        } else { // Handle 'Error' and 'Success' statuses
          statusContainer.textContent = response.message;
        }
      });

      promptInput.value = '';
    } else {
      statusContainer.textContent = 'Please enter a prompt.';
    }
  });
});
