import { PrismaClient, UserRole, IssueStatus, IssuePriority } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create default categories
  const categories = [
    {
      name: 'Οδοποιία',
      nameEn: 'Road Works',
      description: 'Προβλήματα οδοποιίας και ασφάλτου',
      color: '#FF6B35',
      icon: 'road'
    },
    {
      name: 'Φωτισμός',
      nameEn: 'Lighting',
      description: 'Προβλήματα φωτισμού δρόμων',
      color: '#F7931E',
      icon: 'lightbulb'
    },
    {
      name: 'Καθαριότητα',
      nameEn: 'Cleanliness',
      description: 'Θέματα καθαριότητας και απορριμμάτων',
      color: '#4CAF50',
      icon: 'trash'
    },
    {
      name: 'Πράσινο',
      nameEn: 'Green Spaces',
      description: 'Πάρκα και χώροι πρασίνου',
      color: '#8BC34A',
      icon: 'tree'
    },
    {
      name: 'Κυκλοφορία',
      nameEn: 'Traffic',
      description: 'Θέματα κυκλοφορίας και σήμανση',
      color: '#2196F3',
      icon: 'traffic-light'
    },
    {
      name: 'Άλλο',
      nameEn: 'Other',
      description: 'Άλλα θέματα',
      color: '#9C27B0',
      icon: 'help-circle'
    }
  ];

  const createdCategories = [];
  for (const categoryData of categories) {
    const category = await prisma.category.create({
      data: categoryData
    });
    createdCategories.push(category);
    console.log(`✅ Created category: ${category.name}`);
  }

  // Create subcategories
  const subcategoriesData = [
    // Οδοποιία subcategories
    {
      name: 'Λακκούβες',
      nameEn: 'Potholes',
      description: 'Λακκούβες στο οδόστρωμα',
      color: '#FF6B35',
      estimatedDays: 7,
      categoryName: 'Οδοποιία'
    },
    {
      name: 'Φθορές ασφάλτου',
      nameEn: 'Asphalt damage',
      description: 'Γενικές φθορές στην άσφαλτο',
      color: '#E64A19',
      estimatedDays: 10,
      categoryName: 'Οδοποιία'
    },
    // Φωτισμός subcategories
    {
      name: 'Φανάρι δεν λειτουργεί',
      nameEn: 'Street light not working',
      description: 'Φανάρι που δεν λειτουργεί',
      color: '#F7931E',
      estimatedDays: 3,
      categoryName: 'Φωτισμός'
    },
    {
      name: 'Κατεστραμμένο φανάρι',
      nameEn: 'Damaged street light',
      description: 'Φανάρι που έχει υποστεί ζημιά',
      color: '#FF9800',
      estimatedDays: 5,
      categoryName: 'Φωτισμός'
    },
    // Καθαριότητα subcategories
    {
      name: 'Σκουπίδια',
      nameEn: 'Litter',
      description: 'Σκουπίδια σε δημόσιους χώρους',
      color: '#4CAF50',
      estimatedDays: 1,
      categoryName: 'Καθαριότητα'
    },
    {
      name: 'Γεμάτος κάδος',
      nameEn: 'Full trash bin',
      description: 'Γεμάτος κάδος απορριμμάτων',
      color: '#388E3C',
      estimatedDays: 1,
      categoryName: 'Καθαριότητα'
    }
  ];

  for (const subcatData of subcategoriesData) {
    const category = createdCategories.find(cat => cat.name === subcatData.categoryName);
    if (category) {
      const subcategory = await prisma.subcategory.create({
        data: {
          name: subcatData.name,
          nameEn: subcatData.nameEn,
          description: subcatData.description,
          color: subcatData.color,
          estimatedDays: subcatData.estimatedDays,
          categoryId: category.id
        }
      });
      console.log(`✅ Created subcategory: ${subcategory.name}`);
    }
  }

  // Create default admin user
  const hashedPassword = await bcrypt.hash('admin123', 12);
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@glyfada.gr',
      username: 'admin',
      password: hashedPassword,
      firstName: 'Διαχειριστής',
      lastName: 'Συστήματος',
      role: UserRole.ADMIN,
      phone: '+30210000000'
    }
  });
  console.log('✅ Created admin user:', adminUser.email);

  // Create supervisor user
  const supervisorPassword = await bcrypt.hash('supervisor123', 12);
  const supervisorUser = await prisma.user.create({
    data: {
      email: 'supervisor@glyfada.gr',
      username: 'supervisor',
      password: supervisorPassword,
      firstName: 'Επόπτης',
      lastName: 'Εργασιών',
      role: UserRole.SUPERVISOR,
      phone: '+30210000001'
    }
  });
  console.log('✅ Created supervisor user:', supervisorUser.email);

  // Create office user
  const officePassword = await bcrypt.hash('office123', 12);
  const officeUser = await prisma.user.create({
    data: {
      email: 'office@glyfada.gr',
      username: 'office',
      password: officePassword,
      firstName: 'Γραφείο',
      lastName: 'Υποστήριξης',
      role: UserRole.OFFICE,
      phone: '+30210000002'
    }
  });
  console.log('✅ Created office user:', officeUser.email);

  // Create regular user
  const userPassword = await bcrypt.hash('user123', 12);
  const regularUser = await prisma.user.create({
    data: {
      email: 'user@example.com',
      username: 'testuser',
      password: userPassword,
      firstName: 'Γιάννης',
      lastName: 'Παπαδόπουλος',
      role: UserRole.USER,
      phone: '+30690000000'
    }
  });
  console.log('✅ Created regular user:', regularUser.email);

  // Create some sample issues
  const roadCategory = createdCategories.find(cat => cat.name === 'Οδοποιία');
  const lightingCategory = createdCategories.find(cat => cat.name === 'Φωτισμός');

  if (roadCategory && lightingCategory) {
    // Get subcategories
    const potholeSubcat = await prisma.subcategory.findFirst({
      where: { name: 'Λακκούβες', categoryId: roadCategory.id }
    });
    const lightSubcat = await prisma.subcategory.findFirst({
      where: { name: 'Φανάρι δεν λειτουργεί', categoryId: lightingCategory.id }
    });

    const issues = [
      {
        title: 'Μεγάλη λακκούβα στην οδό Βουλιαγμένης',
        description: 'Υπάρχει μεγάλη λακκούβα που δημιουργεί κίνδυνο για τα οχήματα',
        address: 'Λεωφόρος Βουλιαγμένης 125, Γλυφάδα',
        latitude: 37.8633,
        longitude: 23.7524,
        categoryId: roadCategory.id,
        subcategoryId: potholeSubcat?.id,
        createdById: regularUser.id,
        priority: IssuePriority.HIGH,
        isEmergency: false,
        referenceNumber: 'GLY-2024-001'
      },
      {
        title: 'Φανάρι δεν λειτουργεί',
        description: 'Το φανάρι στη γωνία δεν λειτουργεί εδώ και μια εβδομάδα',
        address: 'Λεωφόρος Ποσειδώνος 45, Γλυφάδα',
        latitude: 37.8701,
        longitude: 23.7531,
        categoryId: lightingCategory.id,
        subcategoryId: lightSubcat?.id,
        createdById: regularUser.id,
        assignedToId: supervisorUser.id,
        status: IssueStatus.IN_PROGRESS,
        priority: IssuePriority.MEDIUM,
        isEmergency: false,
        referenceNumber: 'GLY-2024-002'
      }
    ];

    for (const issueData of issues) {
      const issue = await prisma.issue.create({
        data: issueData
      });
      console.log(`✅ Created issue: ${issue.title} (${issue.referenceNumber})`);
    }
  }

  // Create default settings
  const settings = [
    {
      key: 'SYSTEM_NAME',
      value: 'myGlyfada',
      description: 'System name displayed in UI'
    },
    {
      key: 'MAX_PHOTOS_PER_ISSUE',
      value: '5',
      description: 'Maximum number of photos per issue'
    },
    {
      key: 'ISSUE_AUTO_ASSIGN',
      value: 'false',
      description: 'Automatically assign issues to supervisors'
    }
  ];

  for (const setting of settings) {
    await prisma.settings.create({
      data: setting
    });
    console.log(`✅ Created setting: ${setting.key}`);
  }

  console.log('🎉 Database seeding completed successfully!');
  console.log('\n👤 Default users created:');
  console.log('   Admin: admin@glyfada.gr / admin123');
  console.log('   Supervisor: supervisor@glyfada.gr / supervisor123');
  console.log('   Office: office@glyfada.gr / office123');
  console.log('   User: user@example.com / user123');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });