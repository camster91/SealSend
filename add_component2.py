file_path = 'src/app/(dashboard)/events/[eventId]/page.tsx'

with open(file_path, 'r') as f:
    lines = f.readlines()

# Find the line with Marketing Tools comment
for i, line in enumerate(lines):
    if 'Marketing Tools' in line:
        # Insert AutoRemindersToggle before this section
        indent = ' ' * 8  # 8 spaces for indentation
        new_lines = [
            f'{indent}{{/* Auto Reminders */}}\n',
            f'{indent}<div className=mt-6>\n',
            f'{indent}  <AutoRemindersToggle eventId={{eventId}} />\n',
            f'{indent}</div>\n',
            f'\n',
            line  # Keep the original Marketing Tools line
        ]
        
        # Replace from i to i (insert at position i)
        lines[i:i] = new_lines
        break

with open(file_path, 'w') as f:
    f.writelines(lines)

print('Added AutoRemindersToggle component before Marketing Tools')
