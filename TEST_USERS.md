# ข้อมูลผู้ใช้สำหรับทดสอบระบบ

## วิธีการรัน Seed Data

```bash
cd evidence-management-system
npx prisma db seed
```

## ข้อมูลผู้ใช้ทดสอบ

**หมายเหตุ**: ในโหมด Development สามารถใช้รหัสผ่านอะไรก็ได้ (เช่น "password", "123456", "test")

### 👨‍💼 ผู้ดูแลระบบ (ADMIN)
- **Email**: `admin@school.edu`
- **ชื่อ**: System Administrator
- **สิทธิ์**: เข้าถึงทุกฟีเจอร์ในระบบ

- **Email**: `admin2@school.edu`
- **ชื่อ**: Assistant Administrator
- **สิทธิ์**: เข้าถึงทุกฟีเจอร์ในระบบ

### 👩‍🏫 ครู (TEACHER)
- **Email**: `teacher1@school.edu`
- **ชื่อ**: Alice Johnson (Math Teacher)
- **สิทธิ์**: อัปโหลดหลักฐานสำหรับตัวชี้วัดที่ได้รับมอบหมาย

- **Email**: `teacher2@school.edu`
- **ชื่อ**: Bob Smith (Science Teacher)

- **Email**: `teacher3@school.edu`
- **ชื่อ**: Carol Davis (English Teacher)

- **Email**: `teacher4@school.edu`
- **ชื่อ**: David Wilson (History Teacher)

- **Email**: `teacher5@school.edu`
- **ชื่อ**: Emma Brown (Art Teacher)

### 🔍 ผู้ประเมิน IQA (IQA_EVALUATOR)
- **Email**: `iqa1@school.edu`
- **ชื่อ**: Dr. Sarah Miller (IQA Lead)
- **สิทธิ์**: ประเมินหลักฐานปีการศึกษาปัจจุบันเท่านั้น

- **Email**: `iqa2@school.edu`
- **ชื่อ**: Prof. Michael Chen (IQA)

- **Email**: `iqa3@school.edu`
- **ชื่อ**: Dr. Lisa Anderson (IQA)

### 🔍 ผู้ประเมิน EQA (EQA_EVALUATOR)
- **Email**: `eqa1@school.edu`
- **ชื่อ**: Dr. Robert Taylor (EQA Lead)
- **สิทธิ์**: ประเมินหลักฐานย้อนหลัง 4 ปี (ปีปัจจุบัน ถึง N-3)

- **Email**: `eqa2@school.edu`
- **ชื่อ**: Prof. Jennifer Lee (EQA)

### 👔 ผู้บริหาร (EXECUTIVE)
- **Email**: `executive1@school.edu`
- **ชื่อ**: Principal John Executive
- **สิทธิ์**: ดู Dashboard ผู้บริหาร และส่งออกรายงาน

- **Email**: `executive2@school.edu`
- **ชื่อ**: Vice Principal Mary Leader

## ข้อมูลที่สร้างในระบบ

### ปีการศึกษา (Academic Years)
- **ปีปัจจุบัน**: 2025-2026 (เปิดให้อัปโหลดและประเมิน)
- **ปีย้อนหลัง**: 2024-2025, 2023-2024, 2022-2023 (สำหรับทดสอบ EQA)

### ระดับการศึกษา (Education Levels)
- Early Childhood Education (ECE)
- Primary Education (PRIMARY)
- Secondary Education (SECONDARY)
- Higher Education (HIGHER)

### มาตรฐาน (Standards)
- Teaching and Learning Quality
- Student Assessment and Evaluation
- Learning Environment and Resources
- Professional Development
- Curriculum Implementation
- Student Achievement Outcomes
- Technology Integration
- Community Engagement

### ตัวชี้วัด (Indicators) และ ตัวชี้วัดย่อย (Sub-Indicators)
- มีการสร้างตัวชี้วัดและตัวชี้วัดย่อยสำหรับแต่ละมาตรฐาน
- ครูจะได้รับมอบหมายตัวชี้วัดย่อยสำหรับการอัปโหลดหลักฐาน

## การทดสอบฟีเจอร์ต่างๆ

### ทดสอบการเข้าถึงข้อมูลย้อนหลัง
1. **เข้าสู่ระบบด้วย EQA**: `eqa1@school.edu`
2. **ตรวจสอบ**: ควรเห็นปีการศึกษา 2025-2026, 2024-2025, 2023-2024, 2022-2023
3. **เข้าสู่ระบบด้วย IQA**: `iqa1@school.edu`
4. **ตรวจสอบ**: ควรเห็นเฉพาะปีการศึกษา 2025-2026

### ทดสอบการอัปโหลดหลักฐาน
1. **เข้าสู่ระบบด้วย Teacher**: `teacher1@school.edu`
2. **ไปที่**: Evidence Upload
3. **ตรวจสอบ**: ควรเห็นตัวชี้วัดย่อยที่ได้รับมอบหมาย

### ทดสอบ Dashboard ผู้บริหาร
1. **เข้าสู่ระบบด้วย Executive**: `executive1@school.edu`
2. **ไปที่**: Dashboard
3. **ตรวจสอบ**: ควรเห็นข้อมูลสถิติและรายงาน

## คำสั่งที่เป็นประโยชน์

```bash
# รัน seed data
npx prisma db seed

# รีเซ็ตฐานข้อมูลและรัน seed ใหม่
npx prisma db reset

# ดูข้อมูลในฐานข้อมูล
npx prisma studio

# รันเซิร์ฟเวอร์
npm run dev
```

## หมายเหตุสำคัญ

- **Development Mode**: รหัสผ่านใดก็ได้จะทำงาน
- **Production Mode**: จะต้องมีการตรวจสอบรหัสผ่านจริง
- ผู้ใช้ทุกคนมี `isActive: true` และ `deletedAt: null`
- ครูจะได้รับมอบหมายตัวชี้วัดย่อยอัตโนมัติ