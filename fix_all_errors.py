import os

# Fix 1: Remove all source: cron_reminder lines
file_path = 'src/app/api/cron/send-reminders/route.ts'
with open(file_path, 'r') as f:
    content = f.read()

# Remove all source: cron_reminder, lines
content = content.replace(', source: cron_reminder', '')
content = content.replace('source: cron_reminder,', '')

with open(file_path, 'w') as f:
    f.write(content)
print(f'Fixed {file_path}')

# Fix 2: Add non-null assertion in AddGuestModal.tsx
file_path = 'src/components/guests/AddGuestModal.tsx'
with open(file_path, 'r') as f:
    content = f.read()

# Replace watch(notes).length with watch(notes)!.length
content = content.replace('watch(notes).length', 'watch(notes)!.length')

with open(file_path, 'w') as f:
    f.write(content)
print(f'Fixed {file_path}')

print('All fixes applied')
