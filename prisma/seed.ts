import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seed...");

  // Create Academic Years (current and historical for EQA testing)
  const academicYears = [];
  const currentYear = new Date().getFullYear();
  
  for (let i = 0; i < 4; i++) {
    const year = currentYear - i;
    const academicYear = await prisma.academicYear.upsert({
      where: { name: `${year}-${year + 1}` },
      update: {},
      create: {
        name: `${year}-${year + 1}`,
        startDate: new Date(`${year}-08-01`),
        endDate: new Date(`${year + 1}-07-31`),
        uploadWindowOpen: i === 0, // Only current year has upload window open
        evaluationWindowOpen: i === 0, // Only current year has evaluation window open
        isActive: i === 0, // Only current year is active
      },
    });
    academicYears.push(academicYear);
  }

  // Create Education Levels
  const educationLevels = [
    { name: "Early Childhood Education", code: "ECE" },
    { name: "Primary Education", code: "PRIMARY" },
    { name: "Secondary Education", code: "SECONDARY" },
    { name: "Higher Education", code: "HIGHER" },
  ];

  const createdEducationLevels = [];
  for (const level of educationLevels) {
    const educationLevel = await prisma.educationLevel.upsert({
      where: { code: level.code },
      update: {},
      create: level,
    });
    createdEducationLevels.push(educationLevel);
  }

  // Create Standards for each Education Level
  const standardsData = [
    // Primary Education Standards
    { name: "Teaching and Learning Quality", code: "STD001", levelCode: "PRIMARY" },
    { name: "Student Assessment and Evaluation", code: "STD002", levelCode: "PRIMARY" },
    { name: "Learning Environment and Resources", code: "STD003", levelCode: "PRIMARY" },
    { name: "Professional Development", code: "STD004", levelCode: "PRIMARY" },
    
    // Secondary Education Standards
    { name: "Curriculum Implementation", code: "STD005", levelCode: "SECONDARY" },
    { name: "Student Achievement Outcomes", code: "STD006", levelCode: "SECONDARY" },
    { name: "Technology Integration", code: "STD007", levelCode: "SECONDARY" },
    { name: "Community Engagement", code: "STD008", levelCode: "SECONDARY" },
  ];

  const createdStandards = [];
  for (const standardData of standardsData) {
    const educationLevel = createdEducationLevels.find(el => el.code === standardData.levelCode);
    if (educationLevel) {
      const standard = await prisma.standard.upsert({
        where: {
          code_educationLevelId: {
            code: standardData.code,
            educationLevelId: educationLevel.id,
          },
        },
        update: {},
        create: {
          name: standardData.name,
          code: standardData.code,
          educationLevelId: educationLevel.id,
        },
      });
      createdStandards.push(standard);
    }
  }

  // Create Indicators for each Standard
  const indicatorsData = [
    // Teaching and Learning Quality Indicators
    { name: "Lesson Planning and Preparation", code: "IND001", standardCode: "STD001" },
    { name: "Instructional Delivery Methods", code: "IND002", standardCode: "STD001" },
    { name: "Student Engagement Strategies", code: "IND003", standardCode: "STD001" },
    
    // Student Assessment Indicators
    { name: "Formative Assessment Practices", code: "IND004", standardCode: "STD002" },
    { name: "Summative Assessment Design", code: "IND005", standardCode: "STD002" },
    
    // Learning Environment Indicators
    { name: "Classroom Management", code: "IND006", standardCode: "STD003" },
    { name: "Resource Utilization", code: "IND007", standardCode: "STD003" },
    
    // Secondary Education Indicators
    { name: "Subject-Specific Curriculum", code: "IND008", standardCode: "STD005" },
    { name: "Cross-Curricular Integration", code: "IND009", standardCode: "STD005" },
    { name: "Student Performance Tracking", code: "IND010", standardCode: "STD006" },
  ];

  const createdIndicators = [];
  for (const indicatorData of indicatorsData) {
    const standard = createdStandards.find(s => s.code === indicatorData.standardCode);
    if (standard) {
      const indicator = await prisma.indicator.upsert({
        where: {
          code_standardId: {
            code: indicatorData.code,
            standardId: standard.id,
          },
        },
        update: {},
        create: {
          name: indicatorData.name,
          code: indicatorData.code,
          standardId: standard.id,
        },
      });
      createdIndicators.push(indicator);
    }
  }

  // Create Sub-Indicators
  const subIndicatorsData = [
    // Lesson Planning Sub-Indicators
    { name: "Weekly Lesson Plans", code: "SI001", indicatorCode: "IND001" },
    { name: "Learning Objectives Documentation", code: "SI002", indicatorCode: "IND001" },
    { name: "Assessment Rubrics", code: "SI003", indicatorCode: "IND001" },
    
    // Instructional Delivery Sub-Indicators
    { name: "Teaching Method Variety", code: "SI004", indicatorCode: "IND002" },
    { name: "Multimedia Integration", code: "SI005", indicatorCode: "IND002" },
    
    // Student Engagement Sub-Indicators
    { name: "Interactive Activities", code: "SI006", indicatorCode: "IND003" },
    { name: "Student Participation Records", code: "SI007", indicatorCode: "IND003" },
    
    // Assessment Sub-Indicators
    { name: "Quiz and Test Results", code: "SI008", indicatorCode: "IND004" },
    { name: "Project-Based Assessments", code: "SI009", indicatorCode: "IND005" },
    
    // Environment Sub-Indicators
    { name: "Classroom Layout Documentation", code: "SI010", indicatorCode: "IND006" },
    { name: "Learning Materials Inventory", code: "SI011", indicatorCode: "IND007" },
  ];

  const createdSubIndicators = [];
  for (const subIndicatorData of subIndicatorsData) {
    const indicator = createdIndicators.find(i => i.code === subIndicatorData.indicatorCode);
    if (indicator) {
      const subIndicator = await prisma.subIndicator.upsert({
        where: {
          code_indicatorId: {
            code: subIndicatorData.code,
            indicatorId: indicator.id,
          },
        },
        update: {},
        create: {
          name: subIndicatorData.name,
          code: subIndicatorData.code,
          indicatorId: indicator.id,
        },
      });
      createdSubIndicators.push(subIndicator);
    }
  }

  // Create Users with comprehensive test data
  // Note: In development mode, any password will work for these users
  const usersData = [
    // Administrators - Full system access
    { email: "admin@school.edu", name: "System Administrator", role: UserRole.ADMIN },
    { email: "admin2@school.edu", name: "Assistant Administrator", role: UserRole.ADMIN },
    
    // Teachers - Can upload evidence for their assigned sub-indicators
    { email: "teacher1@school.edu", name: "Alice Johnson (Math Teacher)", role: UserRole.TEACHER },
    { email: "teacher2@school.edu", name: "Bob Smith (Science Teacher)", role: UserRole.TEACHER },
    { email: "teacher3@school.edu", name: "Carol Davis (English Teacher)", role: UserRole.TEACHER },
    { email: "teacher4@school.edu", name: "David Wilson (History Teacher)", role: UserRole.TEACHER },
    { email: "teacher5@school.edu", name: "Emma Brown (Art Teacher)", role: UserRole.TEACHER },
    
    // IQA Evaluators - Can evaluate current year only
    { email: "iqa1@school.edu", name: "Dr. Sarah Miller (IQA Lead)", role: UserRole.IQA_EVALUATOR },
    { email: "iqa2@school.edu", name: "Prof. Michael Chen (IQA)", role: UserRole.IQA_EVALUATOR },
    { email: "iqa3@school.edu", name: "Dr. Lisa Anderson (IQA)", role: UserRole.IQA_EVALUATOR },
    
    // EQA Evaluators - Can access current year to N-3 years (4 years total)
    { email: "eqa1@school.edu", name: "Dr. Robert Taylor (EQA Lead)", role: UserRole.EQA_EVALUATOR },
    { email: "eqa2@school.edu", name: "Prof. Jennifer Lee (EQA)", role: UserRole.EQA_EVALUATOR },
    
    // Executives - Can view executive dashboard and export reports
    { email: "executive1@school.edu", name: "Principal John Executive", role: UserRole.EXECUTIVE },
    { email: "executive2@school.edu", name: "Vice Principal Mary Leader", role: UserRole.EXECUTIVE },
  ];

  const createdUsers = [];
  for (const userData of usersData) {
    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {},
      create: {
        ...userData,
        isActive: true,
      },
    });
    createdUsers.push(user);
  }

  // Assign some sub-indicators to teachers for testing
  const teachers = createdUsers.filter(u => u.role === UserRole.TEACHER);
  for (let i = 0; i < Math.min(teachers.length, createdSubIndicators.length); i++) {
    await prisma.subIndicator.update({
      where: { id: createdSubIndicators[i].id },
      data: { ownerId: teachers[i].id },
    });
  }

  console.log("✅ Database seeded successfully!");
  console.log({
    academicYears: academicYears.map(ay => ay.name),
    educationLevels: createdEducationLevels.length,
    standards: createdStandards.length,
    indicators: createdIndicators.length,
    subIndicators: createdSubIndicators.length,
    users: {
      total: createdUsers.length,
      admins: createdUsers.filter(u => u.role === UserRole.ADMIN).length,
      teachers: createdUsers.filter(u => u.role === UserRole.TEACHER).length,
      iqaEvaluators: createdUsers.filter(u => u.role === UserRole.IQA_EVALUATOR).length,
      eqaEvaluators: createdUsers.filter(u => u.role === UserRole.EQA_EVALUATOR).length,
      executives: createdUsers.filter(u => u.role === UserRole.EXECUTIVE).length,
    },
    assignedSubIndicators: createdSubIndicators.filter(si => si.ownerId).length,
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async e => {
    console.error("❌ Seed failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
