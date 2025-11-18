const https://script.google.com/macros/s/AKfycbyxqwYcNIqVAjV_KSRO6QiIXMJ2dYdvLehVPAOmAaWKg5l8KhZinhGdrrv1sZEs5ZbZ/exec = "PASTE_URL_GOOGLE_SCRIPT_DI_SINI";

fetch(https://script.google.com/macros/s/AKfycbyxqwYcNIqVAjV_KSRO6QiIXMJ2dYdvLehVPAOmAaWKg5l8KhZinhGdrrv1sZEs5ZbZ/exec)
  .then(res => res.json())
  .then(data => {
    const tbody = document.getElementById("result-body");

    data.forEach(r => {
      tbody.innerHTML += `
        <tr>
          <td>${new Date(r.timestamp).toLocaleString()}</td>
          <td>${r.name}</td>
          <td>${r.nim}</td>
          <td>${r.class}</td>
          <td>${r.score}</td>
        </tr>
      `;
    });
  });
