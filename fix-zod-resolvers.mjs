import fs from 'fs';
import path from 'path';

function findTsxFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      findTsxFiles(filePath, fileList);
    } else if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const webDir = path.join(process.cwd(), 'apps', 'web');
const dirsToScan = [
  path.join(webDir, 'app'),
  path.join(webDir, 'components')
];

let modifiedCount = 0;

for (const dir of dirsToScan) {
  const files = findTsxFiles(dir);
  
  for (const file of files) {
    const originalContent = fs.readFileSync(file, 'utf-8');
    
    // Replace `zodResolver(schema)` with `zodResolver(schema as any)`
    // Ensures we don't accidentally replace `as any` twice
    const newContent = originalContent.replace(/zodResolver\(([^)]+)\)/g, (match, schemaArg) => {
      if (schemaArg.includes('as any')) {
        return match; // Already fixed
      }
      return `zodResolver(${schemaArg} as any)`;
    });

    if (originalContent !== newContent) {
      fs.writeFileSync(file, newContent, 'utf-8');
      console.log(`✅ Fixed type mismatch in: ${file.replace(process.cwd(), '')}`);
      modifiedCount++;
    }
  }
}

if (modifiedCount === 0) {
  console.log('No files needed fixing or they were already fixed.');
} else {
  console.log(`\n🎉 Successfully fixed ${modifiedCount} files! You can now commit and push.`);
}
