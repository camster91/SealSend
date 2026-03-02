import re

file_path = 'src/app/(dashboard)/events/[eventId]/page.tsx'

with open(file_path, 'r') as f:
    content = f.read()

# Find the ExportTools component and add AutoRemindersToggle before it
# Look for the Marketing Tools section
pattern = r'(\s*{\/\* Marketing Tools \*\/}\s*\n\s*<div className=mt-6>\s*\n\s*<ExportTools)'

replacement = '''        {/* Auto Reminders */}
        <div className=mt-6>
          <AutoRemindersToggle eventId={eventId} />
        </div>

        {/* Marketing Tools */}
        <div className=mt-6>
          <ExportTools'''

if re.search(pattern, content):
    content = re.sub(pattern, replacement, content)
    with open(file_path, 'w') as f:
        f.write(content)
    print('Added AutoRemindersToggle component')
else:
    print('Could not find Marketing Tools section')
