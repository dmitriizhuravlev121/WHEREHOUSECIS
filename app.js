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
        showError("Ошибка инициализации интерфейса.");
        return;
    }

    if (typeof jsQR === "undefined") {
        console.error("Библиотека jsQR не загружена.");
        showError("Ошибка загрузки библиотеки QR-кода.");
        return;
    }

    console.log("Инициализация приложения...");
    startCamera();
    scanQRCode();

    window.addEventListener("beforeunload", stopCamera);
});

async function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showError("Ваш браузер не поддерживает доступ к камере.");
        console.error("getUserMedia не поддерживается.");
        return;
    }

    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: "environment",
                width: { ideal: 640 },
                height: { ideal: 480 }
            }
        });
        video.srcObject = cameraStream;
        video.play();
        console.log("Камера запущена успешно");
    } catch (error) {
        if (error.name === "NotAllowedError") {
            showError("Доступ к камере запрещен. Разрешите доступ в настройках.");
        } else if (error.name === "NotFoundError") {
            showError("Камера не найдена. Проверьте устройство.");
        } else {
            showError("Не удалось запустить камеру.");
            console.error("Ошибка запуска камеры:", error);
        }
    }
}

function stopCamera() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
        video.srcObject = null;
        isScanning = false;
        console.log("Камера остановлена");
    }
}

function handleQRCode(data) {
    try {
        console.log("Обработка QR-кода:", data);
        const scannedData = JSON.parse(data);
        const scannedProductID = scannedData.id;
        const scannedProductName = scannedData.name;

        if (!scannedProductID || !scannedProductName) {
            throw new Error("Неполные данные в QR-коде");
        }

        stopCamera();
        productName.innerText = scannedProductName;
        document.getElementById("formContainer").style.display = "block";

        fetchStock(scannedProductID);

        addButton.onclick = () => sendRequest("add_stock", scannedProductID, scannedProductName);
        subtractButton.onclick = () => sendRequest("subtract_stock", scannedProductID, scannedProductName);

        document.getElementById("rescanButton").onclick = () => {
            document.getElementById("formContainer").style.display = "none";
            startCamera();
            scanQRCode();
        };
    } catch (error) {
        showError("Ошибка чтения QR-кода. Попробуйте снова.");
        console.error("Ошибка обработки QR-кода:", error);
        startCamera();
        scanQRCode();
    }
}

function fetchStock(productID) {
    console.log("Запрос остатка для productID:", productID);
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
                console.log("Остаток получен:", data.quantity);
            }
        })
        .catch(error => {
            showError("Ошибка получения остатка.");
            console.error("Ошибка:", error);
        });
}

function sendRequest(action, productID, productName) {
    const quantity = parseInt(quantityInput.value);

    if (!quantity || isNaN(quantity) || quantity <= 0) {
        showError("Введите корректное количество.");
        return;
    }

    if (action === "subtract_stock") {
        const currentStock = parseInt(stockValue.innerText);
        if (quantity > currentStock) {
            showError(`Нельзя списать ${quantity}. На складе только ${currentStock}.`);
            return;
        }
    }

    addButton.disabled = true;
    subtractButton.disabled = true;

    console.log(`Отправка запроса: ${action}, productID: ${productID}, quantity: ${quantity}`);
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
                fetchStock(productID);
            }
        })
        .catch(error => {
            showError("Ошибка выполнения запроса.");
            console.error("Ошибка:", error);
        })
        .finally(() => {
            addButton.disabled = false;
            subtractButton.disabled = false;
            quantityInput.value = "";
        });
}

function scanQRCode() {
    if (isScanning || !cameraStream) {
        console.log("Сканирование заблокировано: isScanning =", isScanning, ", cameraStream =", !!cameraStream);
        return;
    }
    isScanning = true;
    console.log("Запуск сканирования QR-кода");

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    function processFrame() {
        if (!isScanning || !video.srcObject) {
            console.log("Сканирование остановлено: isScanning =", isScanning, ", video.srcObject =", !!video.srcObject);
            return;
        }

        try {
            if (video.videoWidth > 0 && video.videoHeight > 0) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                context.drawImage(video, 0, 0, canvas.width, canvas.height);

                const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
                const code = jsQR(imageData.data, canvas.width, canvas.height);

                if (code) {
                    console.log("QR-код найден:", code.data);
                    isScanning = false;
                    handleQRCode(code.data);
                    return;
                } else {
                    console.log("QR-код не найден в кадре");
                }
            } else {
                console.log("Видео не готово: videoWidth =", video.videoWidth, ", videoHeight =", video.videoHeight);
            }
        } catch (error) {
            console.error("Ошибка обработки кадра:", error);
            showError("Ошибка сканирования. Попробуйте снова.");
        }

        requestAnimationFrame(processFrame);
    }

    console.log("Начало обработки кадров");
    requestAnimationFrame(processFrame);
}

function showError(message) {
    const errorMessage = document.getElementById("errorMessage");
    errorMessage.innerText = message;
    setTimeout(() => (errorMessage.innerText = ""), 5000);
    console.error("Ошибка:", message);
}

function showConfirmation(message) {
    const confirmationMessage = document.getElementById("confirmationMessage");
    const confirmationText = document.getElementById("confirmationText");
    confirmationText.innerText = message;
    confirmationMessage.style.display = "block";

    document.getElementById("closeConfirmation").onclick = () => {
        confirmationMessage.style.display = "none";
    };
    console.log("Подтверждение:", message);
}
