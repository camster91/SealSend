file_path = 'src/app/(dashboard)/events/[eventId]/page.tsx'

with open(file_path, 'r') as f:
    content = f.read()

# Fix the className and remove duplicate comment
content = content.replace('<div className=mt-6>', '<div className=mt-6>')
content = content.replace('{/* Marketing Tools */}\n        {/* Marketing Tools */}', '{/* Marketing Tools */}')

with open(file_path, 'w') as f:
    f.write(content)

print('Fixed component formatting')
