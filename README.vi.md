# CCS - Claude Code Switch

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Language: Bash | PowerShell](https://img.shields.io/badge/Language-Bash%20%7C%20PowerShell-blue.svg)]()
[![Platform: macOS | Linux | Windows](https://img.shields.io/badge/Platform-macOS%20%7C%20Linux%20%7C%20Windows-lightgrey.svg)]()

**Ngôn ngữ**: [English](README.md) | [Tiếng Việt](README.vi.md)

> Chuyển đổi giữa Claude Sonnet 4.5 và GLM 4.6 ngay lập tức. Dùng đúng model cho từng tác vụ.

**Vấn đề**: Bạn có cả Claude subscription và GLM Coding Plan. Hai tình huống xảy ra hàng ngày:
1. **Rate limit**: Claude hết lượt giữa chừng project, phải tự tay sửa file `~/.claude/settings.json` để chuyển
2. **Tối ưu công việc**: Planning phức tạp cần trí tuệ của Claude Sonnet 4.5, nhưng coding đơn giản thì GLM 4.6 vẫn làm tốt

Chuyển đổi thủ công rất mất thời gian và dễ sai.

**Giải pháp**:
```bash
ccs           # Dùng Claude subscription (mặc định)
ccs glm       # Chuyển sang GLM fallback
# Hết rate limit? Chuyển ngay:
ccs glm       # Tiếp tục làm việc với GLM
```

Một lệnh. Không downtime. Không phải sửa file. Đúng model, đúng việc.

## Bắt Đầu Nhanh

### Cài đặt:

**macOS / Linux**:
```bash
curl -fsSL ccs.kaitran.ca/install | bash
```

**Windows PowerShell**:
```powershell
irm ccs.kaitran.ca/install | iex
```

**~/.ccs/config.json** (tự động tạo khi cài đặt):
```json
{
  "profiles": {
    "glm": "~/.ccs/glm.settings.json",
    "default": "~/.claude/settings.json"
  }
}
```

### Sử dụng:
```bash
ccs              # Dùng Claude subscription (mặc định)
ccs glm          # Dùng GLM fallback
ccs --version    # Hiển thị phiên bản CCS
ccs --install    # Cài đặt lệnh và kỹ năng CCS vào ~/.claude/
```

### Delegation Tác Vụ

CCS bao gồm delegation tác vụ thông minh qua meta-command `/ccs`:

```bash
# Sau khi chạy ccs --install, bạn có thể dùng:
/ccs glm /plan "add user authentication"
/ccs glm /code "implement auth endpoints"
/ccs glm /ask "explain this error"
```

**Lợi ích**:
- ✅ Tiết kiệm tokens bằng cách delegation tác vụ đơn giản cho model rẻ hơn
- ✅ Dùng đúng model cho từng tác vụ tự động
- ✅ Tích hợp liền mạch với workflows hiện có

## Triết Lý

- **YAGNI**: Không có tính năng "phòng hờ"
- **KISS**: Bash đơn giản, không phức tạp
- **DRY**: Một nguồn chân lý duy nhất (config)

## Gỡ Cài Đặt

**macOS / Linux**:
```bash
curl -fsSL ccs.kaitran.ca/uninstall | bash
```

**Windows PowerShell**:
```powershell
irm ccs.kaitran.ca/uninstall | iex
```

**Tìm hiểu thêm**: Tài liệu đầy đủ có sẵn trong [docs/vi/](./docs/vi/)
- [Hướng dẫn Cài đặt](./docs/vi/installation.vi.md)
- [Cấu hình](./docs/vi/configuration.vi.md)
- [Ví dụ Sử dụng](./docs/vi/usage.vi.md)
- [Khắc phục Sự cố](./docs/vi/troubleshooting.vi.md)
- [Đóng góp](./docs/vi/contributing.vi.md)

---

*Được tạo với ❤️ bởi [Kai Tran](https://github.com/kaitranntt)*
