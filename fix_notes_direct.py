file_path = 'src/components/guests/AddGuestModal.tsx'
with open(file_path, 'r') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'watch(notes).length' in line:
        lines[i] = line.replace('watch(notes).length', 'watch(notes)!.length')
        print(f'Fixed line {i+1}')

with open(file_path, 'w') as f:
    f.writelines(lines)

print('Fixed AddGuestModal.tsx')
