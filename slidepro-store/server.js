const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware for parsing JSON with high limit for images
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Data directory & file
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'store.json');

// Ensure data dir exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial seed data
function getDefaultData() {
    return {
        adminPassword: 'admin123',
        bank: {
            code: 'MB',
            account: '0365781696',
            owner: 'DUONG BA HAI QUAN'
        },
        pantryId: '',
        paidOrders: {},
        slides: [
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
        ]
    };
}

// ===== CLOUD STORAGE INTEGRATION (Pantry Cloud) =====
let activePantryId = process.env.PANTRY_ID || '';

async function fetchFromPantry(id) {
    const targetId = id || activePantryId;
    if (!targetId) return null;
    try {
        const res = await fetch(`https://getpantry.cloud/apiv1/pantry/${targetId}/basket/slidepro_store`);
        if (res.ok) {
            const data = await res.json();
            return data;
        }
    } catch (e) {
        console.warn('Lỗi kết nối Pantry Cloud:', e.message);
    }
    return null;
}

async function syncToPantry(data, id) {
    const targetId = id || activePantryId;
    if (!targetId) return;
    try {
        await fetch(`https://getpantry.cloud/apiv1/pantry/${targetId}/basket/slidepro_store`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        console.log('=> Đã đồng bộ dữ liệu lên Pantry Cloud thành công!');
    } catch (e) {
        console.warn('Lỗi khi lưu lên Pantry Cloud:', e.message);
    }
}

// Read store helper
function readStore() {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            const initial = getDefaultData();
            fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2), 'utf8');
            return initial;
        }
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        if (!parsed.paidOrders) parsed.paidOrders = {};
        if (parsed.pantryId && !activePantryId) activePantryId = parsed.pantryId;
        return parsed;
    } catch (err) {
        console.error('Lỗi khi đọc file store.json:', err);
        return getDefaultData();
    }
}

// Write store helper
function writeStore(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
        // Đồng bộ ngầm lên đám mây nếu có cấu hình
        if (data.pantryId || activePantryId) {
            syncToPantry(data, data.pantryId || activePantryId).catch(() => {});
        }
        return true;
    } catch (err) {
        console.error('Lỗi khi ghi file store.json:', err);
        return false;
    }
}

// Khôi phục tự động từ đám mây khi khởi động
(async () => {
    try {
        const store = readStore();
        const pId = store.pantryId || activePantryId;
        if (pId) {
            console.log('Đang kiểm tra dữ liệu từ đám mây Pantry...');
            const cloudData = await fetchFromPantry(pId);
            if (cloudData && Array.isArray(cloudData.slides) && cloudData.slides.length > 0) {
                // Đảm bảo không mất mật khẩu và ngân hàng
                store.slides = cloudData.slides;
                if (cloudData.bank) store.bank = cloudData.bank;
                if (cloudData.paidOrders) store.paidOrders = cloudData.paidOrders;
                fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), 'utf8');
                console.log(`=> ĐÃ KHÔI PHỤC THÀNH CÔNG ${store.slides.length} SLIDE TỪ ĐÁM MÂY KHI KHỞI ĐỘNG!`);
            }
        }
    } catch (err) {
        console.warn('Khởi động đám mây:', err.message);
    }
})();

// ===== API ROUTES =====

// 1. Lấy dữ liệu công khai (dành cho cả máy khách & admin)
app.get('/api/data', (req, res) => {
    const store = readStore();
    res.json({
        success: true,
        slides: store.slides || [],
        bank: store.bank || { code: 'MB', account: '0365781696', owner: 'DUONG BA HAI QUAN' },
        pantryId: store.pantryId || activePantryId || ''
    });
});

// 2. Lưu danh sách slides (đồng bộ máy khách và lưu vĩnh viễn trên server)
app.post('/api/slides', (req, res) => {
    const { slides } = req.body;
    if (!Array.isArray(slides)) {
        return res.status(400).json({ success: false, message: 'Dữ liệu slides không hợp lệ!' });
    }
    const store = readStore();
    store.slides = slides;
    if (writeStore(store)) {
        res.json({ success: true, count: store.slides.length });
    } else {
        res.status(500).json({ success: false, message: 'Lỗi ghi dữ liệu trên server!' });
    }
});

// 3. Lưu cài đặt ngân hàng
app.post('/api/bank', (req, res) => {
    const { bank } = req.body;
    if (!bank) {
        return res.status(400).json({ success: false, message: 'Thiếu thông tin ngân hàng!' });
    }
    const store = readStore();
    store.bank = bank;
    if (writeStore(store)) {
        res.json({ success: true, bank: store.bank });
    } else {
        res.status(500).json({ success: false, message: 'Lỗi lưu ngân hàng trên server!' });
    }
});

// 4. Lưu Pantry ID cho đám mây
app.post('/api/pantry', async (req, res) => {
    const { pantryId } = req.body;
    const store = readStore();
    store.pantryId = pantryId ? pantryId.trim() : '';
    activePantryId = store.pantryId;

    if (writeStore(store)) {
        // Đồng bộ dữ liệu hiện tại lên Pantry ngay lập tức
        if (activePantryId) {
            await syncToPantry(store, activePantryId);
        }
        res.json({ success: true, message: 'Đã lưu cấu hình đám mây thành công!' });
    } else {
        res.status(500).json({ success: false, message: 'Lỗi lưu cấu hình đám mây!' });
    }
});

// 5. Xác thực đăng nhập Admin
app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    const store = readStore();
    const correctPassword = store.adminPassword || 'admin123';
    if (password === correctPassword) {
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, message: 'Mật khẩu quản trị không chính xác!' });
    }
});

// 6. Đổi mật khẩu Admin
app.post('/api/admin/change-password', (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const store = readStore();
    const correctPassword = store.adminPassword || 'admin123';

    if (oldPassword !== correctPassword) {
        return res.status(400).json({ success: false, message: 'Mật khẩu hiện tại không chính xác!' });
    }
    if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ success: false, message: 'Mật khẩu mới phải có tối thiểu 6 ký tự!' });
    }

    store.adminPassword = newPassword;
    if (writeStore(store)) {
        res.json({ success: true, message: 'Đổi mật khẩu thành công!' });
    } else {
        res.status(500).json({ success: false, message: 'Lỗi lưu mật khẩu trên server!' });
    }
});

// ===== SEPAY WEBHOOK & THANH TOÁN TỰ ĐỘNG =====

// 7. Nhận Webhook từ SePay khi có biến động số dư chuyển khoản
app.post('/api/sepay-webhook', (req, res) => {
    try {
        const body = req.body || {};
        console.log('SePay Webhook Nhận Được:', body);

        const content = (body.content || body.description || '').toUpperCase();
        const transferAmount = Number(body.transferAmount || body.amount || 0);

        const match = content.match(/SLD\d+/);
        const store = readStore();
        store.paidOrders = store.paidOrders || {};

        if (match) {
            const orderId = match[0];
            store.paidOrders[orderId] = {
                paidAt: Date.now(),
                amount: transferAmount,
                gateway: body.gateway || 'Bank',
                transactionDate: body.transactionDate || new Date().toISOString()
            };
            writeStore(store);
            console.log(`=> ĐƠN HÀNG ${orderId} ĐÃ ĐƯỢC XÁC NHẬN THANH TOÁN THÀNH CÔNG TỪ SEPAY!`);
        } else if (body.code) {
            const orderId = String(body.code).toUpperCase();
            store.paidOrders[orderId] = {
                paidAt: Date.now(),
                amount: transferAmount
            };
            writeStore(store);
        }

        res.json({ success: true });
    } catch (err) {
        console.error('Lỗi khi xử lý SePay webhook:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 8. Kiểm tra trạng thái đơn hàng (máy khách gọi tự động mỗi 2 giây)
app.get('/api/orders/check', (req, res) => {
    const orderId = (req.query.orderId || '').toUpperCase();
    const store = readStore();
    const paidOrders = store.paidOrders || {};

    if (orderId && paidOrders[orderId]) {
        res.json({ paid: true, order: paidOrders[orderId] });
    } else {
        res.json({ paid: false });
    }
});

// Phục vụ static files
app.use(express.static(path.join(__dirname)));

// Single Page Application routing fallback
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`SlidePro Store Server running at port ${PORT}`);
});
