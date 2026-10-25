/* ============================================
   SlidePro STORE - Application Logic
   ============================================ */

// ===== CONFIGURATION =====
const CONFIG = {
    STORAGE_KEYS: {
        SLIDES: 'slidepro_slides',
        BANK: 'slidepro_bank',
        ADMIN_LOGGED: 'slidepro_admin_logged',
        ADMIN_PASSWORD: 'slidepro_admin_password'
    },
    
    BANK_NAMES: {
        'MB': 'MB Bank (Quân Đội)',
        'VCB': 'Vietcombank',
        'TCB': 'Techcombank',
        'ACB': 'ACB',
        'VPB': 'VPBank',
        'TPB': 'TPBank',
        'STB': 'Sacombank',
        'BIDV': 'BIDV',
        'CTG': 'VietinBank',
        'AGR': 'Agribank'
    },

    CATEGORY_NAMES: {
        'business': 'Kinh doanh & Startup',
        'finance': 'Tài chính & Doanh nghiệp',
        'education': 'Giáo dục & Đào tạo',
        'marketing': 'Marketing & Bán hàng'
    }
};

// ===== STATE =====
let slides = [];
let currentFilter = 'all';
let currentSearchQuery = '';
let currentSlide = null;
let currentSlideIndex = 0;
let tempPreviewImages = [];
let tempDeliveryFileData = null;

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', async () => {
    await loadInitialData();
});

// Kiểm tra xem danh sách slide có phải là dữ liệu mẫu ban đầu chưa chỉnh sửa không
function isDefaultSampleSlides(slideList) {
    if (!Array.isArray(slideList) || slideList.length === 0) return true;
    const isDefaults = slideList.length === 3 && slideList.every(s => 
        (s.id === 'slide_default_1' || s.id === 'slide_default_2' || s.id === 'slide_default_3') &&
        (!s.previewImages || s.previewImages.length === 0)
    );
    return isDefaults;
}

// ===== DATA LOADING & SYNCHRONIZATION =====
async function loadInitialData() {
    let localSlides = [];
    try {
        const localData = localStorage.getItem(CONFIG.STORAGE_KEYS.SLIDES);
        if (localData) localSlides = JSON.parse(localData);
    } catch (e) {}

    let loadedFromServer = false;
    try {
        const response = await fetch('/api/data', { cache: 'no-store' });
        if (response.ok) {
            const data = await response.json();
            if (data.success && Array.isArray(data.slides)) {
                const serverIsDefault = isDefaultSampleSlides(data.slides);
                const localHasCustom = Array.isArray(localSlides) && localSlides.length > 0 && !isDefaultSampleSlides(localSlides);

                // NGUYÊN TẮC BẢO VỆ DỮ LIỆU:
                // Nếu server vừa khởi động lại (chỉ có slide mẫu trống), nhưng máy của bạn đã lưu bài viết thật:
                // TUYỆT ĐỐI KHÔNG GHI ĐÈ! Tự động gửi dữ liệu bài viết thật lên để khôi phục máy chủ!
                if (serverIsDefault && localHasCustom) {
                    slides = localSlides;
                    console.log('Phát hiện máy chủ vừa khởi động lại. Đang tự động khôi phục dữ liệu lên máy chủ...');
                    fetch('/api/slides', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ slides: localSlides })
                    }).then(() => {
                        showToast('⚡ Đã tự động khôi phục toàn bộ bài viết & ảnh của bạn lên máy chủ!', 'success');
                    }).catch(() => {});
                } else if (!serverIsDefault) {
                    // Server có bài viết thực tế
                    slides = data.slides;
                    try {
                        localStorage.setItem(CONFIG.STORAGE_KEYS.SLIDES, JSON.stringify(slides));
                    } catch (e) {}
                } else {
                    slides = localHasCustom ? localSlides : data.slides;
                }

                if (data.bank) {
                    applyBankSettings(data.bank);
                    try {
                        localStorage.setItem(CONFIG.STORAGE_KEYS.BANK, JSON.stringify(data.bank));
                    } catch (e) {}
                }

                if (data.pantryId) {
                    const pInput = document.getElementById('pantryIdInput');
                    if (pInput) pInput.value = data.pantryId;
                }

                loadedFromServer = true;
            }
        }
    } catch (e) {
        console.warn('Không thể kết nối đến máy chủ, sẽ sử dụng bộ nhớ cục bộ:', e);
    }

    // 2. Nếu không kết nối được server (chạy offline / mở file html trực tiếp)
    if (!loadedFromServer) {
        slides = (Array.isArray(localSlides) && localSlides.length > 0) ? localSlides : getSampleSlides();
        loadBankSettingsFromLocalStorage();
    }

    renderProducts();
    renderAdminTable();
}

function loadSlidesFromLocalStorage() {
    try {
        const data = localStorage.getItem(CONFIG.STORAGE_KEYS.SLIDES);
        slides = data ? JSON.parse(data) : getSampleSlides();
    } catch (e) {
        slides = getSampleSlides();
    }
}

// Lưu dữ liệu lên máy chủ và đồng bộ cục bộ
async function saveSlides() {
    // Lưu vào bộ nhớ trình duyệt làm cache
    try {
        localStorage.setItem(CONFIG.STORAGE_KEYS.SLIDES, JSON.stringify(slides));
    } catch (e) {
        console.warn('Không thể lưu vào localStorage (có thể vượt dung lượng):', e);
    }

    // Đồng bộ lên máy chủ để máy khách (điện thoại, máy tính khác) đều thấy
    try {
        const res = await fetch('/api/slides', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slides })
        });
        if (res.ok) {
            showToast('Đã lưu và đồng bộ lên máy chủ thành công!', 'success');
        } else {
            const err = await res.json();
            showToast('Lỗi lưu máy chủ: ' + (err.message || 'Thất bại'), 'error');
        }
    } catch (e) {
        console.warn('Không thể lưu lên server (chế độ offline):', e);
        showToast('Đã lưu cục bộ trên trình duyệt!', 'info');
    }
}

function applyBankSettings(bank) {
    const bankNameEl = document.getElementById('bankName');
    const bankAccountEl = document.getElementById('bankAccount');
    const bankOwnerEl = document.getElementById('bankOwner');

    if (bankNameEl && bank.code) bankNameEl.value = bank.code;
    if (bankAccountEl && bank.account) bankAccountEl.value = bank.account;
    if (bankOwnerEl && bank.owner) bankOwnerEl.value = bank.owner;
}

function loadBankSettingsFromLocalStorage() {
    try {
        const data = localStorage.getItem(CONFIG.STORAGE_KEYS.BANK);
        if (data) {
            applyBankSettings(JSON.parse(data));
            return;
        }
    } catch (e) {}

    // Giá trị mặc định
    applyBankSettings({
        code: 'MB',
        account: '0988889999',
        owner: 'NGUYEN VAN QUAN'
    });
}

async function saveBankSettings() {
    const bank = {
        code: document.getElementById('bankName').value,
        account: document.getElementById('bankAccount').value.trim(),
        owner: document.getElementById('bankOwner').value.trim()
    };

    try {
        localStorage.setItem(CONFIG.STORAGE_KEYS.BANK, JSON.stringify(bank));
    } catch (e) {}

    try {
        const res = await fetch('/api/bank', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bank })
        });
        if (res.ok) {
            showToast('Đã lưu cài đặt ngân hàng lên máy chủ!', 'success');
            return;
        }
    } catch (e) {}

    showToast('Đã lưu cài đặt ngân hàng!', 'success');
}

function getBankSettings() {
    return {
        code: document.getElementById('bankName')?.value || 'MB',
        account: document.getElementById('bankAccount')?.value || '0988889999',
        owner: document.getElementById('bankOwner')?.value || 'NGUYEN VAN QUAN'
    };
}

// ===== SAMPLE DATA =====
function getSampleSlides() {
    return [
        {
            id: 'slide_default_1',
            title: 'BẠO LỰC HỌC ĐƯỜNG',
            price: 30000,
            category: 'education',
            pages: 19,
            ratio: '16:9 Full HD',
            compat: 'PowerPoint, Google Slides, Canva',
            description: 'Tổng màu chủ đạo: Sử dụng sắc xanh lá (green) kết hợp xanh dương (blue) mang lại cảm giác thân thiện, dịu mắt, nghiêm túc nhưng không quá nặng nề, rất phù hợp cho chủ đề tuyên truyền giáo dục học đường.\n\nBố cục: Được chia thành 6 phần logic rõ ràng từ định nghĩa, hình thức, thực trạng, biểu hiện, nguyên nhân đến giải pháp.\n\n- Trình bày dạng sơ đồ tư duy, khối thông tin (block) kết hợp hình ảnh minh họa sinh động.\n- Phù hợp cho sinh viên, giáo viên, hoặc tổ chức giáo dục cần trình bày về chủ đề này.',
            previewImages: [],
            deliveryType: 'link',
            deliveryLink: 'https://docs.google.com/presentation/d/121kBFknwdSd8gg2gRtqNeLecdTfRKsmg/edit?usp=drive_link&ouid=110278634742153176794&rtpof=true&sd=true',
            deliveryFileData: null,
            deliveryFileName: null,
            createdAt: Date.now()
        },
        {
            id: 'slide_default_2',
            title: 'Slide Marketing Kế Hoạch Ra Mắt Sản Phẩm Mới - Product Launch Plan',
            price: 45000,
            category: 'marketing',
            pages: 48,
            ratio: '16:9 Full HD',
            compat: 'PowerPoint, Google Slides, Canva',
            description: 'Bộ slide Marketing chuyên nghiệp dành cho việc trình bày kế hoạch ra mắt sản phẩm mới. Bao gồm đầy đủ các phần:\n\n- Phân tích thị trường & đối thủ cạnh tranh\n- Chiến lược Marketing Mix (4P)\n- Timeline triển khai chi tiết\n- Budget & ROI dự kiến\n- KPIs đo lường hiệu quả\n\nThiết kế hiện đại, màu sắc chuyên nghiệp, phù hợp cho các buổi pitch với ban lãnh đạo.',
            previewImages: [],
            deliveryType: 'link',
            deliveryLink: 'https://drive.google.com/example2',
            deliveryFileData: null,
            deliveryFileName: null,
            createdAt: Date.now()
        },
        {
            id: 'slide_default_3',
            title: 'Slide Giảng Dạy & Khóa Học Online Tương Tác - E-Learning Template',
            price: 35000,
            category: 'education',
            pages: 42,
            ratio: '16:9 Full HD',
            compat: 'PowerPoint, Google Slides, Canva',
            description: 'Template slide giảng dạy hiện đại, tối ưu cho các khóa học online và bài giảng trực tuyến.\n\nĐặc điểm nổi bật:\n- Bố cục rõ ràng, dễ theo dõi trên màn hình\n- Tông màu nhẹ nhàng, không gây mỏi mắt\n- Có sẵn các slide tương tác: Quiz, Q&A, Brainstorm\n- Infographic và biểu đồ minh họa đẹp mắt\n- Phù hợp cho giáo viên, giảng viên, trainer',
            previewImages: [],
            deliveryType: 'link',
            deliveryLink: 'https://drive.google.com/example3',
            deliveryFileData: null,
            deliveryFileName: null,
            createdAt: Date.now()
        }
    ];
}

// ===== UTILS =====
function generateId() {
    return 'slide_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
}

function generateOrderId() {
    return 'SLD' + Math.floor(10000 + Math.random() * 90000);
}

function formatPrice(price) {
    return new Intl.NumberFormat('vi-VN').format(price) + ' đ';
}

function getCategoryName(key) {
    return CONFIG.CATEGORY_NAMES[key] || key;
}

function getBankFullName(code) {
    return CONFIG.BANK_NAMES[code] || code;
}

// ===== TOAST NOTIFICATIONS =====
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { success: 'check-circle', error: 'exclamation-circle', info: 'info-circle' };
    toast.innerHTML = `<i class="fas fa-${icons[type] || 'info-circle'}"></i> ${message}`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(30px)';
        setTimeout(() => toast.remove(), 300);
    }, 3200);
}

// ===== NAVIGATION =====
function showStorefront() {
    document.getElementById('storefrontSection').style.display = 'block';
    document.getElementById('adminSection').style.display = 'none';
    renderProducts();
}

function showAdminLogin() {
    const isLogged = sessionStorage.getItem(CONFIG.STORAGE_KEYS.ADMIN_LOGGED);
    if (isLogged === 'true') {
        showAdminPanel();
        return;
    }
    document.getElementById('adminLoginModal').classList.add('active');
    document.getElementById('adminPassword').value = '';
    document.getElementById('loginError').style.display = 'none';
    setTimeout(() => document.getElementById('adminPassword').focus(), 100);
}

function closeAdminLogin() {
    document.getElementById('adminLoginModal').classList.remove('active');
}

// Xác thực đăng nhập Admin (gửi lên server)
async function verifyAdmin() {
    const pw = document.getElementById('adminPassword').value;
    if (!pw) {
        showToast('Vui lòng nhập mật khẩu quản trị!', 'error');
        return;
    }

    try {
        const res = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: pw })
        });
        const data = await res.json();
        if (data.success) {
            sessionStorage.setItem(CONFIG.STORAGE_KEYS.ADMIN_LOGGED, 'true');
            closeAdminLogin();
            showAdminPanel();
            showToast('Đăng nhập quản trị thành công!', 'success');
            return;
        }
    } catch (e) {
        // Fallback khi chạy offline
        const localPw = localStorage.getItem(CONFIG.STORAGE_KEYS.ADMIN_PASSWORD) || 'admin123';
        if (pw === localPw) {
            sessionStorage.setItem(CONFIG.STORAGE_KEYS.ADMIN_LOGGED, 'true');
            closeAdminLogin();
            showAdminPanel();
            showToast('Đăng nhập quản trị thành công!', 'success');
            return;
        }
    }

    document.getElementById('loginError').style.display = 'block';
    document.getElementById('adminPassword').value = '';
    document.getElementById('adminPassword').focus();
}

// Đổi mật khẩu Admin (gửi lên server và lưu vĩnh viễn)
async function changeAdminPassword() {
    const oldPw = document.getElementById('oldPassword').value;
    const newPw = document.getElementById('newPassword').value;
    const confirmPw = document.getElementById('confirmPassword').value;
    const message = document.getElementById('passwordMessage');

    if (!oldPw || !newPw || !confirmPw) {
        message.style.color = '#EF4444';
        message.textContent = 'Vui lòng nhập đầy đủ các ô mật khẩu!';
        return;
    }

    if (newPw.length < 6) {
        message.style.color = '#EF4444';
        message.textContent = 'Mật khẩu mới phải có ít nhất 6 ký tự!';
        return;
    }

    if (newPw !== confirmPw) {
        message.style.color = '#EF4444';
        message.textContent = 'Mật khẩu xác nhận không khớp!';
        return;
    }

    try {
        const res = await fetch('/api/admin/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ oldPassword: oldPw, newPassword: newPw })
        });
        const data = await res.json();

        if (data.success) {
            localStorage.setItem(CONFIG.STORAGE_KEYS.ADMIN_PASSWORD, newPw);
            message.style.color = '#10B981';
            message.textContent = 'Đổi mật khẩu thành công và đã lưu lên máy chủ!';
            document.getElementById('oldPassword').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmPassword').value = '';
            showToast('Đổi mật khẩu thành công!', 'success');
            return;
        } else {
            message.style.color = '#EF4444';
            message.textContent = data.message || 'Mật khẩu hiện tại không chính xác!';
            return;
        }
    } catch (e) {
        // Fallback offline
        const localPw = localStorage.getItem(CONFIG.STORAGE_KEYS.ADMIN_PASSWORD) || 'admin123';
        if (oldPw !== localPw) {
            message.style.color = '#EF4444';
            message.textContent = 'Mật khẩu hiện tại không đúng!';
            return;
        }
        localStorage.setItem(CONFIG.STORAGE_KEYS.ADMIN_PASSWORD, newPw);
        message.style.color = '#10B981';
        message.textContent = 'Đổi mật khẩu thành công!';
        document.getElementById('oldPassword').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmPassword').value = '';
        showToast('Đổi mật khẩu thành công!', 'success');
    }
}

function togglePassword() {
    const input = document.getElementById('adminPassword');
    const icon = input.parentElement.querySelector('.toggle-pw i');
    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'fas fa-eye-slash';
    } else {
        input.type = 'password';
        icon.className = 'fas fa-eye';
    }
}

function showAdminPanel() {
    document.getElementById('storefrontSection').style.display = 'none';
    document.getElementById('adminSection').style.display = 'block';
    renderAdminTable();
    updateSepayWebhookUrl();
}

function updateSepayWebhookUrl() {
    const el = document.getElementById('sepayWebhookUrl');
    if (el) {
        el.value = window.location.origin + '/api/sepay-webhook';
    }
}

function copyWebhookUrl() {
    const el = document.getElementById('sepayWebhookUrl');
    if (!el) return;
    navigator.clipboard.writeText(el.value).then(() => {
        showToast('Đã copy link Webhook SePay!', 'success');
    }).catch(() => {
        el.select();
        document.execCommand('copy');
        showToast('Đã copy link Webhook SePay!', 'success');
    });
}

// ===== SAO LƯU & KHÔI PHỤC VĨNH VIỄN =====
function exportBackup() {
    const backupData = {
        slides: slides,
        bank: getBankSettings(),
        exportedAt: new Date().toISOString(),
        version: '1.0'
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    a.download = `SlidePro_Backup_${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('💾 Đã tải file sao lưu (.json) về máy tính thành công!', 'success');
}

function importBackup(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (Array.isArray(data.slides)) {
                slides = data.slides;
                if (data.bank) {
                    applyBankSettings(data.bank);
                    await saveBankSettings();
                }
                await saveSlides();
                renderProducts();
                renderAdminTable();
                showToast(`🎉 Khôi phục thành công ${slides.length} bài slide & toàn bộ ảnh!`, 'success');
            } else {
                showToast('File sao lưu không đúng định dạng JSON của SlidePro!', 'error');
            }
        } catch (err) {
            showToast('Lỗi khi đọc file sao lưu: ' + err.message, 'error');
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

async function savePantryId() {
    const input = document.getElementById('pantryIdInput');
    if (!input) return;
    const pantryId = input.value.trim();

    try {
        const res = await fetch('/api/pantry', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pantryId })
        });
        const data = await res.json();
        if (data.success) {
            showToast('☁️ Đã lưu cấu hình và đồng bộ lên đám mây Pantry vĩnh viễn!', 'success');
        } else {
            showToast('Lỗi cấu hình đám mây: ' + data.message, 'error');
        }
    } catch (e) {
        showToast('Lỗi gửi yêu cầu đến máy chủ!', 'error');
    }
}

// ===== MOBILE MENU =====
function toggleMobileMenu() {
    document.getElementById('mobileMenu').classList.toggle('active');
}

function closeMobileMenu() {
    document.getElementById('mobileMenu').classList.remove('active');
}

// ===== SEARCH & FILTER =====
function handleSearch(query) {
    currentSearchQuery = query.toLowerCase().trim();
    renderProducts();
}

function filterByCategory(category, btn) {
    currentFilter = category;
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    renderProducts();
}

function getFilteredSlides() {
    let filtered = [...slides];

    if (currentFilter !== 'all') {
        filtered = filtered.filter(s => s.category === currentFilter);
    }

    if (currentSearchQuery) {
        filtered = filtered.filter(s =>
            s.title.toLowerCase().includes(currentSearchQuery) ||
            getCategoryName(s.category).toLowerCase().includes(currentSearchQuery) ||
            (s.description && s.description.toLowerCase().includes(currentSearchQuery))
        );
    }

    return filtered;
}

// ===== RENDER PRODUCTS =====
function renderProducts() {
    const grid = document.getElementById('productGrid');
    const empty = document.getElementById('emptyState');
    if (!grid || !empty) return;

    const filtered = getFilteredSlides();
    const countEl = document.getElementById('filterCount');
    if (countEl) countEl.textContent = `Hiển thị ${filtered.length} mẫu slide`;

    if (filtered.length === 0) {
        grid.innerHTML = '';
        empty.style.display = 'block';
        return;
    }

    empty.style.display = 'none';

    grid.innerHTML = filtered.map(slide => {
        const thumb = slide.previewImages && slide.previewImages.length > 0
            ? slide.previewImages[0]
            : generatePlaceholderSVG(slide.title);

        return `
            <div class="product-card" onclick="openDetailModal('${slide.id}')">
                <div class="card-image">
                    <div class="card-badges">
                        <span class="badge-category">${getCategoryName(slide.category)}</span>
                        <span class="badge-pages">${slide.pages} Slides</span>
                    </div>
                    <img src="${thumb}" alt="${slide.title}" loading="lazy">
                </div>
                <div class="card-body">
                    <h3 class="card-title">${slide.title}</h3>
                    <div class="card-price">
                        <span class="card-price-value">${formatPrice(slide.price)}</span>
                        <span class="card-price-badge"><i class="fas fa-bolt"></i> Nhận file ngay</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function generatePlaceholderSVG(title) {
    const colors = [
        ['#4F46E5', '#818CF8'],
        ['#0EA5E9', '#38BDF8'],
        ['#8B5CF6', '#A78BFA'],
        ['#06B6D4', '#22D3EE'],
        ['#6366F1', '#A5B4FC']
    ];
    const colorPair = colors[Math.abs(hashCode(title)) % colors.length];
    const words = title.trim().split(/\s+/);
    const initials = (words[0] ? words[0][0] : 'S') + (words[1] ? words[1][0] : 'P');
    
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
        <defs>
            <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:${colorPair[0]}"/>
                <stop offset="100%" style="stop-color:${colorPair[1]}"/>
            </linearGradient>
        </defs>
        <rect width="640" height="360" fill="url(#bg)"/>
        <text x="320" y="160" text-anchor="middle" font-family="Arial,sans-serif" font-size="64" font-weight="bold" fill="rgba(255,255,255,0.3)">${initials.toUpperCase()}</text>
        <text x="320" y="210" text-anchor="middle" font-family="Arial,sans-serif" font-size="16" fill="rgba(255,255,255,0.6)">Slide Preview</text>
    </svg>`;

    return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
}

function hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
    }
    return hash;
}

// ===== DETAIL MODAL =====
function openDetailModal(slideId) {
    currentSlide = slides.find(s => s.id === slideId);
    if (!currentSlide) return;

    currentSlideIndex = 0;

    document.getElementById('modalCatBadge').textContent = getCategoryName(currentSlide.category);
    document.getElementById('detailTitle').textContent = currentSlide.title;
    document.getElementById('detailPrice').textContent = formatPrice(currentSlide.price);
    document.getElementById('detailPages').textContent = `${currentSlide.pages} Trang slide`;
    document.getElementById('detailRatio').textContent = currentSlide.ratio || '16:9 Full HD';
    document.getElementById('detailCompat').textContent = currentSlide.compat || 'PowerPoint, Google Slides, Canva';
    document.getElementById('detailDesc').textContent = currentSlide.description || 'Chưa có mô tả chi tiết.';

    updateSlider();

    document.getElementById('detailModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeDetailModal() {
    document.getElementById('detailModal').classList.remove('active');
    document.body.style.overflow = '';
}

function updateSlider() {
    const images = currentSlide.previewImages && currentSlide.previewImages.length > 0
        ? currentSlide.previewImages
        : [generatePlaceholderSVG(currentSlide.title)];

    const sliderImg = document.getElementById('sliderImage');
    sliderImg.src = images[currentSlideIndex];
    sliderImg.alt = `Slide Preview ${currentSlideIndex + 1}`;

    document.getElementById('sliderCounter').textContent = `${currentSlideIndex + 1} / ${images.length}`;

    const thumbsContainer = document.getElementById('sliderThumbs');
    thumbsContainer.innerHTML = images.map((img, i) =>
        `<img src="${img}" alt="Thumb ${i+1}" class="${i === currentSlideIndex ? 'active' : ''}" onclick="goToSlide(${i})">`
    ).join('');
}

function prevSlide() {
    if (!currentSlide) return;
    const images = currentSlide.previewImages && currentSlide.previewImages.length > 0
        ? currentSlide.previewImages
        : [generatePlaceholderSVG(currentSlide.title)];
    currentSlideIndex = (currentSlideIndex - 1 + images.length) % images.length;
    updateSlider();
}

function nextSlide() {
    if (!currentSlide) return;
    const images = currentSlide.previewImages && currentSlide.previewImages.length > 0
        ? currentSlide.previewImages
        : [generatePlaceholderSVG(currentSlide.title)];
    currentSlideIndex = (currentSlideIndex + 1) % images.length;
    updateSlider();
}

function goToSlide(index) {
    currentSlideIndex = index;
    updateSlider();
}

// ===== PAYMENT MODAL =====
let currentOrderId = '';
let paymentCheckInterval = null;

function openPaymentModal() {
    if (!currentSlide) return;

    currentOrderId = generateOrderId();
    const bank = getBankSettings();

    document.getElementById('paymentTitle').textContent = currentSlide.title;
    document.getElementById('paymentOrderId').textContent = currentOrderId;
    document.getElementById('payAmount').textContent = formatPrice(currentSlide.price);
    document.getElementById('payMemo').textContent = currentOrderId;
    document.getElementById('payBank').textContent = getBankFullName(bank.code);
    document.getElementById('payAccountNum').textContent = bank.account;
    document.getElementById('payAccountName').textContent = bank.owner;

    // Tạo mã VietQR động
    const qrUrl = `https://img.vietqr.io/image/${bank.code}-${bank.account}-compact2.png?amount=${currentSlide.price}&addInfo=${currentOrderId}&accountName=${encodeURIComponent(bank.owner)}`;
    document.getElementById('qrImage').src = qrUrl;

    document.getElementById('statusWaiting').style.display = 'flex';
    document.getElementById('statusSuccess').style.display = 'none';

    closeDetailModal();
    document.getElementById('paymentModal').classList.add('active');
    document.body.style.overflow = 'hidden';

    // Bắt đầu lắng nghe tự động biến động số dư từ SePay mỗi 2 giây
    startPaymentPolling(currentOrderId);
}

function closePaymentModal() {
    if (paymentCheckInterval) {
        clearInterval(paymentCheckInterval);
        paymentCheckInterval = null;
    }
    document.getElementById('paymentModal').classList.remove('active');
    document.body.style.overflow = '';
}

function startPaymentPolling(orderId) {
    if (paymentCheckInterval) clearInterval(paymentCheckInterval);

    paymentCheckInterval = setInterval(async () => {
        try {
            const res = await fetch(`/api/orders/check?orderId=${orderId}`, { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                if (data.paid) {
                    clearInterval(paymentCheckInterval);
                    paymentCheckInterval = null;
                    onPaymentSuccess();
                }
            }
        } catch (e) {
            // Trường hợp chạy offline hoặc không kết nối được
        }
    }, 2000);
}

function onPaymentSuccess() {
    document.getElementById('statusWaiting').style.display = 'none';
    document.getElementById('statusSuccess').style.display = 'block';

    const downloadLink = document.getElementById('downloadLink');
    if (currentSlide.deliveryType === 'file' && currentSlide.deliveryFileData) {
        downloadLink.href = currentSlide.deliveryFileData;
        downloadLink.download = currentSlide.deliveryFileName || 'slide.pptx';
        downloadLink.removeAttribute('target');
        downloadLink.innerHTML = '<i class="fas fa-download"></i> Tải File Slide Ngay (.pptx)';
    } else if (currentSlide.deliveryLink) {
        downloadLink.href = currentSlide.deliveryLink;
        downloadLink.target = '_blank';
        downloadLink.removeAttribute('download');
        downloadLink.innerHTML = '<i class="fas fa-external-link-alt"></i> Mở Link Nhận Slide Ngay';
    } else {
        downloadLink.href = '#';
        downloadLink.onclick = (e) => {
            e.preventDefault();
            showToast('Chưa có file hoặc liên kết tải cho sản phẩm này.', 'error');
        };
    }

    showToast('🎉 Đã xác nhận tiền vào tài khoản! Tải file slide ngay bên dưới.', 'success');
}

function copyMemo() {
    const memo = document.getElementById('payMemo').textContent;
    navigator.clipboard.writeText(memo).then(() => {
        showToast('Đã copy nội dung chuyển khoản: ' + memo, 'success');
    }).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = memo;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        showToast('Đã copy nội dung chuyển khoản: ' + memo, 'success');
    });
}

// ===== CLIENT-SIDE IMAGE COMPRESSION (Tối ưu ảnh nhẹ, sắc nét, không bị mất khi lưu) =====
function compressImage(file, maxWidth = 1280, maxHeight = 720, quality = 0.82) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                // Tự động thu gọn kích thước chuẩn HD mà không làm vỡ hình
                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width = Math.round(width * ratio);
                    height = Math.round(height * ratio);
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Nén JPEG chất lượng cao, dung lượng cực nhẹ (~60KB-120KB)
                const dataUrl = canvas.toDataURL('image/jpeg', quality);
                resolve(dataUrl);
            };
            img.onerror = () => resolve(e.target.result);
            img.src = e.target.result;
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
    });
}

// ===== ADMIN: IMAGE UPLOAD =====
async function handleImageUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    showToast(`Đang xử lý & tối ưu hóa ${files.length} ảnh preview...`, 'info');

    let count = 0;
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) continue;

        try {
            const compressed = await compressImage(file, 1280, 720, 0.82);
            if (compressed) {
                tempPreviewImages.push(compressed);
                count++;
            }
        } catch (err) {
            console.error('Lỗi khi nén ảnh:', err);
        }
    }

    renderPreviewThumbs();
    event.target.value = '';
    showToast(`Đã thêm thành công ${count} ảnh preview sắc nét!`, 'success');
}

function renderPreviewThumbs() {
    const container = document.getElementById('previewThumbs');
    if (!container) return;
    container.innerHTML = tempPreviewImages.map((img, i) => `
        <div class="preview-thumb">
            <img src="${img}" alt="Preview ${i+1}">
            <button class="remove-thumb" onclick="removePreviewImage(${i})" title="Xóa ảnh">&times;</button>
        </div>
    `).join('');
}

function removePreviewImage(index) {
    tempPreviewImages.splice(index, 1);
    renderPreviewThumbs();
}

// ===== ADMIN: FILE DELIVERY =====
function toggleDeliveryType() {
    const type = document.querySelector('input[name="deliveryType"]:checked').value;
    document.getElementById('deliveryLink').style.display = type === 'link' ? 'block' : 'none';
    document.getElementById('deliveryFile').style.display = type === 'file' ? 'block' : 'none';
}

function handleDeliveryFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
        showToast('File quá lớn (>20MB). Vui lòng sử dụng liên kết ngoài (Google Drive / Canva).', 'error');
        event.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        tempDeliveryFileData = e.target.result;
        document.getElementById('deliveryFileName').innerHTML = `
            <i class="fas fa-file"></i> ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)
        `;
    };
    reader.readAsDataURL(file);
}

// ===== ADMIN: FORM SUBMIT =====
async function handleSlideSubmit(event) {
    event.preventDefault();

    const editId = document.getElementById('editSlideId').value;
    const deliveryType = document.querySelector('input[name="deliveryType"]:checked').value;

    const slideData = {
        title: document.getElementById('slideTitle').value.trim(),
        price: parseInt(document.getElementById('slidePrice').value) || 0,
        category: document.getElementById('slideCategory').value,
        pages: parseInt(document.getElementById('slidePages').value) || 1,
        ratio: document.getElementById('slideRatio').value || '16:9 Full HD',
        compat: document.getElementById('slideCompat').value || 'PowerPoint, Google Slides, Canva',
        description: document.getElementById('slideDesc').value.trim(),
        deliveryType: deliveryType,
        deliveryLink: deliveryType === 'link' ? document.getElementById('slideDeliveryLink').value.trim() : '',
    };

    if (editId) {
        // Cập nhật slide hiện có
        const index = slides.findIndex(s => s.id === editId);
        if (index !== -1) {
            slides[index] = {
                ...slides[index],
                ...slideData,
                previewImages: [...tempPreviewImages], // Cập nhật đúng danh sách ảnh preview hiện tại
            };
            if (deliveryType === 'file' && tempDeliveryFileData) {
                slides[index].deliveryFileData = tempDeliveryFileData;
                const fileInput = document.getElementById('slideDeliveryFile');
                slides[index].deliveryFileName = fileInput.files[0]?.name || slides[index].deliveryFileName || 'slide.pptx';
            }
            showToast('Đang cập nhật slide...', 'info');
        }
    } else {
        // Thêm slide mới
        const newSlide = {
            id: generateId(),
            ...slideData,
            previewImages: [...tempPreviewImages],
            deliveryFileData: deliveryType === 'file' ? tempDeliveryFileData : null,
            deliveryFileName: deliveryType === 'file' && tempDeliveryFileData
                ? (document.getElementById('slideDeliveryFile').files[0]?.name || 'slide.pptx')
                : null,
            createdAt: Date.now()
        };
        slides.unshift(newSlide);
        showToast('Đang thêm slide mới...', 'info');
    }

    // Lưu và đồng bộ lên server
    await saveSlides();
    renderProducts();
    renderAdminTable();
    resetForm();
}

function resetForm() {
    document.getElementById('slideForm').reset();
    document.getElementById('editSlideId').value = '';
    document.getElementById('formTitle').innerHTML = '<i class="fas fa-plus-circle"></i> Thêm Slide Mới';
    document.getElementById('submitBtn').innerHTML = '<i class="fas fa-save"></i> Lưu Slide';
    document.getElementById('slideRatio').value = '16:9 Full HD';
    document.getElementById('slideCompat').value = 'PowerPoint, Google Slides, Canva';
    tempPreviewImages = [];
    tempDeliveryFileData = null;
    renderPreviewThumbs();
    document.getElementById('deliveryFileName').innerHTML = '';
    document.getElementById('deliveryLink').style.display = 'block';
    document.getElementById('deliveryFile').style.display = 'none';
    document.querySelector('input[name="deliveryType"][value="link"]').checked = true;
}

function editSlide(slideId) {
    const slide = slides.find(s => s.id === slideId);
    if (!slide) return;

    document.getElementById('editSlideId').value = slide.id;
    document.getElementById('formTitle').innerHTML = '<i class="fas fa-edit"></i> Chỉnh Sửa Slide';
    document.getElementById('submitBtn').innerHTML = '<i class="fas fa-save"></i> Cập Nhật';
    document.getElementById('slideTitle').value = slide.title;
    document.getElementById('slidePrice').value = slide.price;
    document.getElementById('slideCategory').value = slide.category;
    document.getElementById('slidePages').value = slide.pages;
    document.getElementById('slideRatio').value = slide.ratio || '16:9 Full HD';
    document.getElementById('slideCompat').value = slide.compat || 'PowerPoint, Google Slides, Canva';
    document.getElementById('slideDesc').value = slide.description || '';

    if (slide.deliveryType === 'file') {
        document.querySelector('input[name="deliveryType"][value="file"]').checked = true;
        toggleDeliveryType();
        if (slide.deliveryFileName) {
            document.getElementById('deliveryFileName').innerHTML = `<i class="fas fa-file"></i> ${slide.deliveryFileName}`;
        }
    } else {
        document.querySelector('input[name="deliveryType"][value="link"]').checked = true;
        toggleDeliveryType();
        document.getElementById('slideDeliveryLink').value = slide.deliveryLink || '';
    }

    tempPreviewImages = slide.previewImages ? [...slide.previewImages] : [];
    renderPreviewThumbs();

    document.getElementById('slideForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function deleteSlide(slideId) {
    if (!confirm('Bạn có chắc chắn muốn xóa slide này?')) return;

    slides = slides.filter(s => s.id !== slideId);
    await saveSlides();
    renderProducts();
    renderAdminTable();
    showToast('Đã xóa slide thành công!', 'success');
}

// ===== ADMIN TABLE =====
function renderAdminTable() {
    const tbody = document.getElementById('adminTableBody');
    const empty = document.getElementById('adminEmpty');
    if (!tbody || !empty) return;

    if (slides.length === 0) {
        tbody.innerHTML = '';
        empty.style.display = 'block';
        return;
    }

    empty.style.display = 'none';

    tbody.innerHTML = slides.map(slide => {
        const thumb = slide.previewImages && slide.previewImages.length > 0
            ? slide.previewImages[0]
            : generatePlaceholderSVG(slide.title);

        return `
            <tr>
                <td><img src="${thumb}" alt="${slide.title}"></td>
                <td><strong>${slide.title}</strong></td>
                <td>${getCategoryName(slide.category)}</td>
                <td>${formatPrice(slide.price)}</td>
                <td>${slide.pages}</td>
                <td>
                    <div class="actions">
                        <button class="btn btn-sm btn-outline" onclick="editSlide('${slide.id}')">
                            <i class="fas fa-edit"></i> Sửa
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteSlide('${slide.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// ===== MODAL CLICK OUTSIDE TO CLOSE =====
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('active');
        document.body.style.overflow = '';
    }
});

// ===== KEYBOARD SHORTCUTS =====
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.active').forEach(m => {
            m.classList.remove('active');
        });
        document.body.style.overflow = '';
    }
    if (e.key === 'ArrowLeft' && document.getElementById('detailModal')?.classList.contains('active')) {
        prevSlide();
    }
    if (e.key === 'ArrowRight' && document.getElementById('detailModal')?.classList.contains('active')) {
        nextSlide();
    }
});
