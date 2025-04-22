let video, productName, quantityInput, addButton, subtractButton, stockValue;
let cameraStream = null;
let isScanning = false;

document.addEventListener("DOMContentLoaded", () => {
    video = document.getElementById("camera");
    productName = document.getElementById("productName");
    quantityInput = document.getElementById("quantity");
    addButton = document.getElementById("addButton");
    subtractButton = document.getElementById("subtractButton");
    stockValue = document.getElementById("stockValue");

    if (!video || !productName || !quantityInput || !addButton || !subtractButton || !stockValue) {
        console.error("Не все элементы DOM найдены. Проверьте HTML.");
        return;
    }

    startCamera();
    scanQRCode();

    // Остановка камеры при закрытии страницы
    window.addEventListener("beforeunload", stopCamera);
});

async function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showError("Ваш браузер не поддерживает доступ к камере.");
        return;
    }

    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        video.srcObject = cameraStream;
        video.play();
    } catch (error) {
        if (error.name === "NotAllowedError") {
            showError("Доступ к камере запрещен. Проверьте настройки браузера.");
        } else if (error.name === "NotFoundError") {
            showError("Камера не найдена. Убедитесь, что устройство имеет камеру.");
        } else {
            showError("Не удалось получить доступ к камере.");
            console.error("Ошибка доступа к камере:", error);
        }
    }
}

function stopCamera() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
        video.srcObject = null;
        isScanning = false;
    }
}

function handleQRCode(data) {
    try {
        const scannedData = JSON.parse(data);
        const scannedProductID = scannedData.id;
        const scannedProductName = scannedData.name;

        stopCamera(); // Останавливаем камеру после успешного сканирования
        productName.innerText = scannedProductName;
        document.getElementById("formContainer").style.display = "block";

        // Запрашиваем остаток на складе
        fetchStock(scannedProductID);

        addButton.onclick = () => sendRequest("add_stock", scannedProductID, scannedProductName);
        subtractButton.onclick = () => sendRequest("subtract_stock", scannedProductID, scannedProductName);

        document.getElementById("rescanButton").onclick = () => {
            document.getElementById("formContainer").style.display = "none";
            startCamera();
            scanQRCode();
        };
    } catch (error) {
        showError("Неверный формат QR-кода.");
        console.error("Ошибка обработки QR-кода:", error);
        startCamera(); // Перезапускаем камеру при ошибке
        scanQRCode();
    }
}

function fetchStock(productID) {
    fetch(`https://wherehousecis.onrender.com/get_stock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_name: productID })
    })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                showError(data.error);
            } else {
                stockValue.innerText = data.quantity || 0;
            }
        })
        .catch(error => {
            showError("Ошибка при получении остатка.");
            console.error("Ошибка:", error);
        });
}

function sendRequest(action, productID, productName) {
    const quantity = parseInt(quantityInput.value);

    if (!quantity || isNaN(quantity) || quantity <= 0) {
        showError("Введите корректное положительное количество.");
        return;
    }

    // Блокируем кнопки
    addButton.disabled = true;
    subtractButton.disabled = true;

    fetch(`https://wherehousecis.onrender.com/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            product_name: productID,
            quantity: quantity,
        }),
    })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                showError(data.error);
            } else {
                showConfirmation(`${action === "add_stock" ? "Добавлено" : "Списано"} ${quantity} ед. товара "${productName}".`);
                fetchStock(productID); // Обновляем остаток
            }
        })
        .catch(error => {
            showError("Произошла ошибка при отправке запроса.");
            console.error("Ошибка:", error);
        })
        .finally(() => {
            // Разблокируем кнопки
            addButton.disabled = false;
            subtractButton.disabled = false;
        });
}

function scanQRCode() {
    if (isScanning || !cameraStream) return;
    isScanning = true;

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    function processFrame() {
        if (!isScanning || !video.srcObject) return;

        if (video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            context.drawImage(video, 0, 0, canvas.width, canvas.height);

            const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, canvas.width, canvas.height);

            if (code) {
                isScanning = false;
                handleQRCode(code.data);
                return;
            }
        }
        requestAnimationFrame(processFrame);
    }

    processFrame();
}

function showError(message) {
    const errorMessage = document.getElementById("errorMessage");
    errorMessage.innerText = message;
    setTimeout(() => (errorMessage.innerText = ""), 3000);
}

function showConfirmation(message) {
    const confirmationMessage = document.getElementById("confirmationMessage");
    const confirmationText = document.getElementById("confirmationText");
    confirmationText.innerText = message;
    confirmationMessage.style.display = "block";

    document.getElementById("closeConfirmation").onclick = () => {
        confirmationMessage.style.display = "none";
    };
}
