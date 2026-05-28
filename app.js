// Backend API configuration
const API_BASE_URL = 'http://localhost:5088';

// Global variables for Chart instances
let trendChartInstance = null;
let deviceChartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    initTabNavigation();
    initAdvancedOptions();
    initShortenForm();
    initStatsSearchForm();
    initCopyButton();
});

/**
 * Handle Tab Navigation
 */
function initTabNavigation() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');

            // Toggle active class on buttons
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Toggle active class on contents
            tabContents.forEach(content => {
                if (content.id === targetTab) {
                    content.classList.add('active');
                } else {
                    content.classList.remove('active');
                }
            });
        });
    });
}

/**
 * Handle collapsible advanced options in shortening form
 */
function initAdvancedOptions() {
    const toggleBtn = document.getElementById('toggle-options-btn');
    const advOptions = document.getElementById('advanced-options');

    toggleBtn.addEventListener('click', () => {
        toggleBtn.classList.toggle('active');
        advOptions.classList.toggle('show');
    });
}

/**
 * Handle Url Shortening Form Submit
 */
function initShortenForm() {
    const form = document.getElementById('shorten-form');
    const alertBox = document.getElementById('shorten-alert');
    const resultPanel = document.getElementById('result-panel');
    const submitBtn = document.getElementById('btn-shorten-submit');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Reset UI
        alertBox.classList.add('hidden');
        alertBox.className = 'alert';
        resultPanel.classList.add('hidden');

        // Form fields
        const originalUrl = document.getElementById('original-url').value.trim();
        const customKey = document.getElementById('custom-key').value.trim() || null;
        const expireDateVal = document.getElementById('expire-date').value;
        const expiresAt = expireDateVal ? new Date(expireDateVal).toISOString() : null;

        // Validation
        if (!originalUrl.startsWith('http://') && !originalUrl.startsWith('https://')) {
            showAlert(alertBox, 'error', 'URL không hợp lệ. Vui lòng nhập đầy đủ tiền tố http:// hoặc https://');
            return;
        }

        if (customKey && customKey.length > 10) {
            showAlert(alertBox, 'error', 'Custom key không được vượt quá 10 ký tự.');
            return;
        }

        // Show loading state on button
        const originalBtnHTML = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner" style="width:20px;height:20px;border-width:2px;display:inline-block;margin-right:8px;"></span> Đang xử lý...';

        try {
            const response = await fetch(`${API_BASE_URL}/api/urls/shorten`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    originalUrl,
                    customKey,
                    expiresAt
                })
            });

            const data = await response.json();

            if (response.ok) {
                // Success: display results
                const shortUrl = data.shortUrl;
                document.getElementById('shortened-url-display').value = shortUrl;
                
                const originalLink = document.getElementById('original-url-display');
                originalLink.href = originalUrl;
                originalLink.textContent = originalUrl;

                // QR Code generator (via open API)
                const qrImage = document.getElementById('qr-image');
                const qrPlaceholder = document.getElementById('qr-placeholder');
                qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(shortUrl)}`;
                qrImage.style.display = 'block';
                qrPlaceholder.style.display = 'none';

                resultPanel.classList.remove('hidden');

                // Extract Key for direct stats link
                const shortKey = shortUrl.substring(shortUrl.lastIndexOf('/') + 1);
                
                // Set direct stats button click action
                const viewStatsDirectBtn = document.getElementById('btn-view-stats-direct');
                viewStatsDirectBtn.onclick = () => {
                    document.getElementById('stats-search-key').value = shortKey;
                    document.getElementById('nav-stats-btn').click();
                    fetchAndDisplayStats(shortKey);
                };
            } else {
                // Conflict or Bad Request
                const errMsg = typeof data === 'string' ? data : (data.title || 'Đã xảy ra lỗi khi rút gọn URL.');
                showAlert(alertBox, 'error', errMsg);
            }
        } catch (error) {
            console.error('Error during shortening:', error);
            showAlert(alertBox, 'error', 'Không thể kết nối đến máy chủ Backend. Vui lòng kiểm tra lại dịch vụ.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnHTML;
        }
    });
}

/**
 * Handle copy to clipboard
 */
function initCopyButton() {
    const copyBtn = document.getElementById('btn-copy-url');
    const inputDisplay = document.getElementById('shortened-url-display');
    const tooltipText = copyBtn.querySelector('.tooltip-text');

    copyBtn.addEventListener('click', () => {
        if (!inputDisplay.value) return;

        inputDisplay.select();
        inputDisplay.setSelectionRange(0, 99999); // For mobile devices

        navigator.clipboard.writeText(inputDisplay.value)
            .then(() => {
                tooltipText.textContent = 'Đã chép!';
                copyBtn.innerHTML = '<i class="fa-solid fa-check"></i><span class="tooltip-text">Đã chép!</span>';
                
                setTimeout(() => {
                    copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i><span class="tooltip-text">Sao chép</span>';
                }, 2000);
            })
            .catch(err => {
                console.error('Failed to copy text: ', err);
            });
    });
}

/**
 * Search Stats Form Submit
 */
function initStatsSearchForm() {
    const form = document.getElementById('stats-search-form');

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const key = document.getElementById('stats-search-key').value.trim();
        if (key) {
            fetchAndDisplayStats(key);
        }
    });
}

/**
 * Fetch and Render Stats from backend
 */
async function fetchAndDisplayStats(key) {
    const alertBox = document.getElementById('stats-alert');
    const loader = document.getElementById('stats-loader');
    const dashboard = document.getElementById('stats-dashboard');

    // Reset UI state
    alertBox.classList.add('hidden');
    alertBox.className = 'alert';
    dashboard.classList.add('hidden');
    loader.classList.remove('hidden');

    try {
        const response = await fetch(`${API_BASE_URL}/api/urls/${key}/stats`);
        
        if (response.status === 404) {
            loader.classList.add('hidden');
            showAlert(alertBox, 'error', 'Mã rút gọn không tồn tại. Vui lòng kiểm tra lại.');
            return;
        }

        if (!response.ok) {
            throw new Error('Server returned an error');
        }

        const data = await response.json();
        loader.classList.add('hidden');

        // Populate Dashboard UI
        document.getElementById('stat-total-clicks').textContent = data.totalClicks;
        document.getElementById('stat-short-key').textContent = data.shortKey;
        
        const originalUrlLink = document.getElementById('stat-original-url');
        originalUrlLink.href = data.originalUrl;
        originalUrlLink.textContent = data.originalUrl;

        // Render charts
        renderCharts(data.clickByDate, data.clickByDevice);

        dashboard.classList.remove('hidden');

    } catch (error) {
        console.error('Error loading stats:', error);
        loader.classList.add('hidden');
        showAlert(alertBox, 'error', 'Không thể lấy dữ liệu thống kê từ máy chủ. Vui lòng thử lại sau.');
    }
}

/**
 * Render Chart.js charts
 */
function renderCharts(clicksByDate, clicksByDevice) {
    // 1. Trend Chart (Line Chart)
    const trendCtx = document.getElementById('trendChart').getContext('2d');
    
    // Sort date labels ascending
    const sortedDates = [...clicksByDate].sort((a, b) => new Date(a.date) - new Date(b.date));
    const dateLabels = sortedDates.map(item => formatDate(item.date));
    const dateValues = sortedDates.map(item => item.count);

    if (trendChartInstance) {
        trendChartInstance.destroy();
    }

    trendChartInstance = new Chart(trendCtx, {
        type: 'line',
        data: {
            labels: dateLabels.length > 0 ? dateLabels : ['Không có dữ liệu'],
            datasets: [{
                label: 'Lượt click',
                data: dateValues.length > 0 ? dateValues : [0],
                borderColor: '#2563eb',
                backgroundColor: 'rgba(37, 99, 235, 0.05)',
                borderWidth: 2,
                fill: true,
                tension: 0.3,
                pointBackgroundColor: '#2563eb',
                pointRadius: 3,
                pointHoverRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    grid: { color: 'rgba(0, 0, 0, 0.05)' },
                    ticks: { color: '#64748b', stepSize: 1 }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#64748b' }
                }
            }
        }
    });

    // 2. Device Chart (Doughnut Chart)
    const deviceCtx = document.getElementById('deviceChart').getContext('2d');
    
    const deviceLabels = clicksByDevice.map(item => {
        switch(item.device?.toLowerCase()) {
            case 'desktop': return 'Máy tính';
            case 'mobile': return 'Điện thoại';
            case 'tablet': return 'Máy tính bảng';
            default: return item.device || 'Khác';
        }
    });
    const deviceValues = clicksByDevice.map(item => item.count);

    if (deviceChartInstance) {
        deviceChartInstance.destroy();
    }

    deviceChartInstance = new Chart(deviceCtx, {
        type: 'doughnut',
        data: {
            labels: deviceLabels.length > 0 ? deviceLabels : ['Chưa có dữ liệu'],
            datasets: [{
                data: deviceValues.length > 0 ? deviceValues : [1],
                backgroundColor: [
                    '#2563eb',
                    '#0891b2',
                    '#f59e0b',
                    '#ec4899',
                    '#10b981'
                ],
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#0f172a', boxWidth: 10, padding: 10 }
                }
            },
            cutout: '65%'
        }
    });
}

/**
 * Helper: Show alert message
 */
function showAlert(container, type, message) {
    container.textContent = message;
    container.className = `alert ${type}`;
    container.classList.remove('hidden');
}

/**
 * Helper: format date for Vietnamese representation
 */
function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN', { month: 'short', day: 'numeric' });
}
