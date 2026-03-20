const prisma = require("./src/lib/prisma");

async function main() {
  const data = {
    name: "Luiz H",
    email: "luiz2@email.com",
    passwordHash: "Teste1234",
  };

  const user = await prisma.user.upsert({
    where: { email: data.email },
    create: data,
    update: {
      name: data.name,
      passwordHash: data.passwordHash,
    },
  });

  console.log("Usuario criado/atualizado:", user);
}

main()
  .catch((error) => {
    console.error("Erro ao criar usuario:", error);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
