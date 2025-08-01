import { GraphQLClient, gql } from 'graphql-request';
import Canvas from 'canvas';
import GIFEncoder from 'gifencoder';
import fs from 'fs';
import 'dotenv/config';

async function getContributions(username, year) {
  const endpoint = 'https://api.github.com/graphql';
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN não definido no .env');

  const client = new GraphQLClient(endpoint, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const query = gql`
    query($username: String!, $from: DateTime!, $to: DateTime!) {
      user(login: $username) {
        contributionsCollection(from: $from, to: $to) {
          contributionCalendar {
            weeks {
              contributionDays {
                contributionCount
              }
            }
          }
        }
      }
    }
  `;

  const variables = {
    username,
    from: `${year}-01-01T00:00:00Z`,
    to: `${year}-12-31T23:59:59Z`,
  };

  const data = await client.request(query, variables);
  const weeks = data.user.contributionsCollection.contributionCalendar.weeks;

  const grid = Array.from({ length: 7 }, () => Array(53).fill(0));
  weeks.forEach((week, col) => {
    week.contributionDays.forEach((day, row) => {
      grid[row][col] = day.contributionCount;
    });
  });

  return { contributions: grid };
}

async function main() {
  const username = 'jp864';
  const year = 2025;
  const cell = 32;

  const gridData = await getContributions(username, year);
  const grid = gridData.contributions;
  const rows = grid.length;
  const cols = grid[0].length;
  const width = cols * cell;
  const height = rows * cell;

  // Cria o caminho completo (fullPath) percorrendo todo o grid em zig-zag (para cobrir tudo)
  const fullPath = [];
  for (let col = 0; col < cols; col++) {
    if (col % 2 === 0) {
      for (let row = 0; row < rows; row++) {
        fullPath.push({ row, col });
      }
    } else {
      for (let row = rows - 1; row >= 0; row--) {
        fullPath.push({ row, col });
      }
    }
  }

  const trail = new Set();

  // Carrega as imagens
  const tuxImg = await Canvas.loadImage('./supertux.png');
  const iglooImg = await Canvas.loadImage('./igloo.png');
  const treeSheet = await Canvas.loadImage('./tree-sheet.png');
  const snowflakes = await Canvas.loadImage('./snowflakes.png');
  const questionBlockImg = await Canvas.loadImage('./question-block.png');
  const coinImg = await Canvas.loadImage('./coin.png');

  const canvas = Canvas.createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const encoder = new GIFEncoder(width, height);
  encoder.createReadStream().pipe(fs.createWriteStream('super-tux-snowy-questions.gif'));
  encoder.start();
  encoder.setRepeat(0);
  encoder.setDelay(400); // lento e suave
  encoder.setQuality(10);

  // SuperTux sprite sheet info
  const tuxFrameWidth = Math.floor(tuxImg.width / 8);  // 8 colunas
  const tuxFrameHeight = Math.floor(tuxImg.height / 11); // 11 linhas
  const tuxFrameCount = 8 * 11; // total frames

  // Árvore: usa só o primeiro tipo para simplificar
  const treeIndex = 0;
  const treeFrameWidth = 110;
  const treeFrameHeight = 110;

  // Posiciona 6 árvores aleatórias
  const treePositions = Array.from({ length: 6 }, () => ({
    row: Math.floor(Math.random() * rows),
    col: Math.floor(Math.random() * cols),
  }));

  // Íglus em posições fixas
  const iglooPositions = [
    { col: 0, row: 6 },
    { col: 50, row: 5 },
    { col: 25, row: 0 },
  ];

  // Mapa dos blocos "?" que ainda não foram hitados
  const questionBlocks = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] > 0) {
        questionBlocks.push({
          row: r,
          col: c,
          hit: false,
          coins: [],
        });
      }
    }
  }

  function hitBlock(block) {
    if (block.hit) return;
    block.hit = true;
    for (let i = 0; i < 5; i++) {
      block.coins.push({
        x: block.col * cell + cell / 2 - 8,
        y: block.row * cell,
        vy: -2 - Math.random() * 1,
        alpha: 1,
        vx: (Math.random() - 0.5) * 2,
      });
    }
  }

  const startTime = Date.now();

  for (let step = 0; step < fullPath.length; step++) {
    const { row, col } = fullPath[step];
    trail.add(`${row}-${col}`);

    // Fundo neve claro
    ctx.fillStyle = '#eefaff';
    ctx.fillRect(0, 0, width, height);

    // Grade contribuições com blocos "?"
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.fillStyle = '#cde6f7'; // leve azul
        ctx.fillRect(c * cell, r * cell, cell, cell);
      }
    }

    // Trilha gelo (posições já visitadas)
    ctx.fillStyle = '#bbdefb';
    trail.forEach(pos => {
      const [r, c] = pos.split('-').map(Number);
      ctx.fillRect(c * cell, r * cell, cell, cell);
    });

    // Desenha blocos "?" não atingidos
    questionBlocks.forEach(block => {
      if (!block.hit) {
        ctx.drawImage(questionBlockImg, block.col * cell, block.row * cell, cell, cell);
      }
    });

    // Ativa moedas se passou no bloco "?"
    questionBlocks.forEach(block => {
      if (!block.hit && block.row === row && block.col === col) {
        hitBlock(block);
      }
    });

    // Anima moedas
    questionBlocks.forEach(block => {
      block.coins = block.coins.filter(coin => coin.alpha > 0);
      block.coins.forEach(coin => {
        coin.x += coin.vx;
        coin.y += coin.vy;
        coin.vy += 0.1;
        coin.alpha -= 0.05;
        ctx.globalAlpha = coin.alpha;
        ctx.drawImage(coinImg, coin.x, coin.y, 16, 16);
        ctx.globalAlpha = 1;
      });
    });

    // Desenha iglus
    iglooPositions.forEach(({ row: r, col: c }) => {
      ctx.drawImage(iglooImg, 0, 0, 192, 64, c * cell, (r - 1) * cell, 96, 32);
    });

    // Desenha árvores (apenas o primeiro tipo)
    treePositions.forEach(({ row: r, col: c }) => {
      ctx.drawImage(treeSheet, 0, 0, treeFrameWidth, treeFrameHeight, c * cell, (r - 1) * cell, 48, 48);
    });

    // Desenha SuperTux
    const frameIndex = step % tuxFrameCount;
    const fx = (frameIndex % 8) * tuxFrameWidth;
    const fy = Math.floor(frameIndex / 8) * tuxFrameHeight;

    ctx.drawImage(
      tuxImg,
      fx,
      fy,
      tuxFrameWidth,
      tuxFrameHeight,
      col * cell,
      row * cell,
      cell,
      cell
    );

    // Flocos de neve
    for (let i = 0; i < 15; i++) {
      const fx = Math.random() * width;
      const fy = (Math.random() * height + step * 2) % height;
      const snowIndex = Math.floor(Math.random() * 18);
      const sx = (snowIndex % 6) * 9;
      const sy = Math.floor(snowIndex / 6) * 9;
      ctx.drawImage(snowflakes, sx, sy, 9, 9, fx, fy, 9, 9);
    }

    // --- Texto: tempo no canto inferior esquerdo ---
    const elapsedSec = Math.floor((Date.now() - startTime) / 1000);
    ctx.font = 'bold 20px Arial';
    ctx.fillStyle = '#004d40';
    ctx.textAlign = 'left';
    ctx.fillText(`TESTE: ${elapsedSec}s`, 10, height - 10);

    // --- Texto: blocos tocados no canto superior direito ---
    const touchedCount = questionBlocks.filter(b => b.hit).length;
    ctx.textAlign = 'right';
    ctx.fillText(`TESTE: ${touchedCount}`, width - 10, 25);

    encoder.addFrame(ctx);
    console.log(`Frame ${step + 1}/${fullPath.length}`);
  }

  encoder.finish();
  console.log('GIF criado com sucesso: super-tux-snowy-questions.gif');
}

main().catch(console.error);
