import { prisma } from './src/config/db.js';

async function main() {
  const latestOtp = await prisma.otpRecord.findFirst({
    orderBy: { createdAt: 'desc' },
  });

  if (!latestOtp) {
    console.log('No OTP records found in database.');
    return;
  }

  console.log('----------------------------------------');
  console.log(`Phone Number : ${latestOtp.phoneNumber}`);
  console.log(`Created At   : ${latestOtp.createdAt.toLocaleString()}`);
  console.log(`Expires At   : ${latestOtp.expiresAt.toLocaleString()}`);
  console.log(`Verified At  : ${latestOtp.verifiedAt ? latestOtp.verifiedAt.toLocaleString() : 'NOT VERIFIED'}`);
  console.log('----------------------------------------');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
