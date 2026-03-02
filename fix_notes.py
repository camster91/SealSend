file_path = 'src/components/guests/AddGuestModal.tsx'
with open(file_path, 'r') as f:
    content = f.read()

# Replace watch(notes).length with watch(notes)!.length
content = content.replace('watch(notes).length', 'watch(notes)!.length')

with open(file_path, 'w') as f:
    f.write(content)

print('Fixed AddGuestModal.tsx')
