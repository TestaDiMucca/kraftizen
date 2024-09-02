import fs from 'fs';
import yaml from 'js-yaml';

export const readYamlConfig = <T>(filePath: string): T => {
  try {
    const fileContents = fs.readFileSync(filePath, 'utf8');
    const data = yaml.load(fileContents);
    return data as T;
  } catch (e) {
    console.error(`Failed to read YAML file: ${e}`);
    return null;
  }
};

export const saveYamlConfig = (data: object, filePath: string): void => {
  try {
    const yamlContent = yaml.dump(data);
    fs.writeFileSync(filePath, yamlContent, 'utf8');
  } catch (e) {
    console.error(`Failed to save YAML file: ${e}`);
  }
};
