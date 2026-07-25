import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('patients') // 1. กำหนดชื่อตารางใน Database ว่า 'patients'
export class Patient {
  @PrimaryGeneratedColumn('uuid') // 2. Primary Key ชนิด UUID (สุ่มให้อัตโนมัติ)
  id: string;

  @Column({ unique: true }) // 3. HN ต้องไม่ซ้ำในระบบ
  hn: string;

  @Column({ name: 'first_name' }) // 4. แมปโปรพอร์ตี้ firstName ➔ คอลัมน์ first_name ใน DB
  firstName: string;

  @Column({ name: 'last_name' }) // 5. แมปโปรพอร์ตี้ lastName ➔ คอลัมน์ last_name ใน DB
  lastName: string;

  @Column({ name: 'id_card', unique: true }) // 6. เลขบัตรประชาชน ห้ามซ้ำ
  idCard: string;

  @CreateDateColumn({ name: 'created_at' }) // 7. เก็บวันที่สร้างข้อมูลให้อัตโนมัติ
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' }) // 8. เก็บวันที่อัปเดตข้อมูลให้อัตโนมัติ
  updatedAt: Date;
}