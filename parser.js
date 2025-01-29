const fs = require('fs');
const yaml = require('js-yaml');

const neo4j = require('neo4j-driver');

const ontologyFilePath = './common-model.schema.yaml';
const ontologyData = yaml.load(fs.readFileSync(ontologyFilePath, 'utf8'));

const classes = ontologyData.classes || {};
const slots = ontologyData.slots || {};

const driver = neo4j.driver('neo4j://localhost:7687', neo4j.auth.basic('neo4j', 'password'));

const session = driver.session();

async function populateNeo4j() {
  try {
    for (const [name, data] of Object.entries(classes)) {
      await session.run(`MERGE (c:Class {name: $name, description: $description})`, {
        name,
        description: data.description || '',
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
      if (classData.is_a) {
        await session.run(
          `MATCH (c1:Class {name: $className}), (c2:Class {name: $isA})
           MERGE (c1)-[:IS_A]->(c2)`,
          { className, isA: classData.is_a }
        );
      }

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
  }
}

populateNeo4j().then(() => {
  console.log('Ontology imported into Neo4j');
  session.close();
  driver.close();
  process.exit(0);
});
