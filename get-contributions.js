import { GraphQLClient, gql } from 'graphql-request';

async function getContributions(username, year) {
  const endpoint = 'https://api.github.com/graphql';
  const token = 'REMOVIDO_POR_SEGURANÇA'; // Substitua pelo seu token
  const client = new GraphQLClient(endpoint, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const query = gql`
    query($username: String!, $from: DateTime!, $to: DateTime!) {
      user(login: $username) {
        contributionsCollection(from: $from, to: $to) {
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                contributionCount
                date
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

  try {
    const data = await client.request(query, variables);
    const weeks = data.user.contributionsCollection.contributionCalendar.weeks;
    const grid = [];
    let currentRow = [];

    // Converte as semanas em uma matriz (aproximadamente 24 linhas x 53 colunas)
    for (const week of weeks) {
      for (const day of week.contributionDays) {
        currentRow.push(day.contributionCount);
        if (currentRow.length === 53) {
          grid.push(currentRow);
          currentRow = [];
        }
      }
    }
    if (currentRow.length > 0) grid.push(currentRow);

    return { contributions: grid };
  } catch (err) {
    console.error(`Erro detalhado: ${err.message}`);
    throw err;
  }
}

// Exemplo de uso:
getContributions('torvalds', 2023)
  .then(data => console.log(JSON.stringify(data, null, 2)))
  .catch(err => console.error(err));