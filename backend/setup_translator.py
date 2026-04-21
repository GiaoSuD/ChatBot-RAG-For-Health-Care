import argostranslate.package

def install():
    print("--- Đang tải dữ liệu dịch thuật (khoảng 200MB)... ---")
    argostranslate.package.update_package_index()
    available_packages = argostranslate.package.get_available_packages()
    
    # Cài đặt gói Tiếng Việt -> Tiếng Anh và ngược lại
    for from_code, to_code in [("vi", "en"), ("en", "vi")]:
        pkg = next(filter(lambda x: x.from_code == from_code and x.to_code == to_code, available_packages))
        print(f"Đang cài đặt gói: {from_code} -> {to_code}...")
        argostranslate.package.install_from_path(pkg.download())
    print("✅ Xong! Giờ bạn có thể xóa file này và chạy main.py.")

if __name__ == "__main__":
    install()