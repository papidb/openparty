const apiBaseInput = document.querySelector("#apiBase");
const inviteCodeInput = document.querySelector("#inviteCode");
const saveButton = document.querySelector("#saveConfig");
const statusNode = document.querySelector("#status");

chrome.storage.sync.get(["apiBase", "inviteCode"], (result) => {
  if (result.apiBase) apiBaseInput.value = result.apiBase;
  if (result.inviteCode) inviteCodeInput.value = result.inviteCode;
});

saveButton.addEventListener("click", () => {
  const apiBase = apiBaseInput.value.trim();
  const inviteCode = inviteCodeInput.value.trim();

  chrome.storage.sync.set({ apiBase, inviteCode }, () => {
    statusNode.textContent = "Saved";
  });
});
