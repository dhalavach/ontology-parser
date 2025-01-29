const fs = require('fs');
const yaml = require('js-yaml');
// const { ApolloServer } = require('@apollo/server');
// const { startStandaloneServer } = require('@apollo/server/standalone');
// const { Neo4jGraphQL } = require('@neo4j/graphql');
const neo4j = require('neo4j-driver');

// Load the YAML file
const ontologyFilePath = './common-model.schema.yaml';
const ontologyData = yaml.load(fs.readFileSync(ontologyFilePath, 'utf8'));

// Extract classes and slots
const classes = ontologyData.classes || {};
const slots = ontologyData.slots || {};

// Connect to Neo4j
const driver = neo4j.driver('neo4j://localhost:7687', neo4j.auth.basic('neo4j', 'password'));

const session = driver.session();

async function populateNeo4j() {
  try {
    for (const [name, data] of Object.entries(classes)) {
      await session.run(`MERGE (c:Class {name: $name, description: $description, isA: $isA})`, {
        name,
        description: data.description || '',
        isA: data.is_a || '',
      });
    }

    for (const [name, data] of Object.entries(slots)) {
      await session.run(`MERGE (s:Slot {name: $name, description: $description, range: $range})`, {
        name,
        description: data.description || '',
        range: data.range || '',
      });
    }

    for (const [className, classData] of Object.entries(classes)) {
      if (classData.slots) {
        for (const slotName of classData.slots) {
          await session.run(
            `MATCH (c:Class {name: $className}), (s:Slot {name: $slotName})
             MERGE (c)-[:HAS_SLOT]->(s)`,
            { className, slotName }
          );
        }
      }
    }
  } catch (error) {
    console.error('Error populating Neo4j:', error);
  } finally {
    await session.close();
  }
}

populateNeo4j().then(() => console.log('Ontology imported into Neo4j'));

const typeDefs = `
  type Class {
    name: String!
    description: String
    isA: String
    slots: [Slot!]! @relationship(type: "HAS_SLOT", direction: OUT)
  }

  type Slot {
    name: String!
    description: String
    range: String
  }

  type Query {
    classes: [Class!]!
    slots: [Slot!]!
  }
`;

// const neoSchema = new Neo4jGraphQL({ typeDefs, driver });

// async function startServer() {
//   const schema = await neoSchema.getSchema();
//   const server = new ApolloServer({ schema });

//   const { url } = await startStandaloneServer(server, {
//     context: ({ req }) => ({ req }),
//     listen: { port: 4000 },
//   });

//   console.log(`GraphQL API ready at ${url}`);
// }

// startServer().catch((error) => console.error('Error starting server:', error));
