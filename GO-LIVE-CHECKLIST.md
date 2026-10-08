# GO LIVE CHECKLIST (10 PHUT)

## 1) Chuan bi GitHub

- Push code moi nhat len repo.
- Dam bao `render.yaml` nam o thu muc goc repository.

## 2) Tao service tren Render

- Vao Render -> New + -> Blueprint.
- Chon dung repo GitHub.
- Xac nhan Render doc duoc render.yaml.
- Kiem tra co Web Service va Persistent Disk duoc tao.

## 3) Cau hinh admin va kiem tra bien moi truong production

- Trong Render service -> Environment, doi chieu theo .env.production.example.
- Bat buoc dung:
  - DATA_DIR=/var/data/gio-hang-ben-thanh/data
  - UPLOAD_DIR=/var/data/gio-hang-ben-thanh/uploads
- Tao `ADMIN_EMAIL` va `ADMIN_PASSWORD_HASH` (scrypt salt + key); khong dat mat khau ro trong repository.
- Neu chua cau hinh hai bien admin, `/admin.html` van bi khoa va dang nhap tra loi `503`.

## 4) Verify sau deploy (3 URL)

Thay <domain> bang domain Render cua ban.

- https://<domain>/health
  - Ky vong: ok=true, uptimeSec > 0
- https://<domain>/admin.html
  - Ky vong: chuyen den `/admin-login.html` khi chua dang nhap
- https://<domain>/admin-login.html
  - Ky vong: hien form dang nhap; sau khi dang nhap moi vao duoc `/admin.html`
- https://<domain>/shop.html
  - Ky vong: vao duoc trang mua hang

## 5) Smoke test du lieu

- Tao 1 san pham moi trong admin.
- Upload 1 anh.
- Mo shop, xac nhan thay san pham.
- Them vao gio, doi so luong, checkout 1 don.
- Reload lai trang admin va shop.
- Ky vong: du lieu van con (khong mat).

## 6) Test restart (quan trong)

- Tren Render bam Manual Deploy (hoac Restart service).
- Sau khi len lai, kiem tra:
  - /health ok
  - san pham vua tao van con
  - hinh upload van hien
  - phien admin van dang nhap va thong ke luot truy cap van con

## 7) Canh bao truoc khi scale

- Cart hien tai la in-memory theo process.
- Khong scale nhieu process/instance neu chua dua cart/session vao Redis hoac DB dung chung.
- Ban hien tai nen chay 1 instance on dinh + persistent disk.

## 8) Theo doi tai cao

- Theo doi /health:
  - inflightRequests
  - memHeapUsedMb
  - memRssMb
- Neu inflightRequests thuong xuyen cao, can:
  - toi uu endpoint
  - gioi han traffic chat hon
  - va chuyen cart sang Redis de scale ngang.

## 9) Domain rieng

- Render -> Settings -> Custom Domains.
- Them domain, cap nhat DNS theo huong dan.
- Doi SSL issue xong roi test lai admin/shop.

## 10) Rollback nhanh neu loi

- Render -> Deploys -> chon ban build truoc do -> Redeploy.
- Kiem tra lai 3 URL verify o muc (4).
