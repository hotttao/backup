---
weight: 1
title: "命令行管理工具 Cobra"
date: 2021-06-21T10:00:00+08:00
lastmod: 2021-06-21T10:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "go 项目的配置管理"
featuredImage: 

tags: ["go 库"]
categories: ["Go"]

lightgallery: true

toc:
  auto: false
---

我们在前面已经学习了 flag/pflag/viper 命令行、配置文件管理的使用，接下来就到了我们今天的主角 cobra 了:
1. cobra 与 viper 没有直接关系，viper 提供的是一个收纳配置参数的容器，cobra 可以用 viper 来管理配置但不是必须。
2. cobra 是 flag/pflag 的扩展，在它们的基础上 cobra 添加了子命令、参数检查等功能，并完全兼容 POSIX（可移植操作系统接口）

## 1. cobra 代码结构

![cobra](/images/go/module/cobra.png)

cobra 的核心就是 Command:

```go
type Command struct {
	Use string

	// Aliases is an array of aliases that can be used instead of the first word in Use.
	Aliases []string

	// SuggestFor is an array of command names for which this command will be suggested -
	// similar to aliases but only suggests.
	SuggestFor []string

	// Short is the short description shown in the 'help' output.
	Short string

	// The group id under which this subcommand is grouped in the 'help' output of its parent.
	GroupID string

	// Long is the long message shown in the 'help <this-command>' output.
	Long string

	// Example is examples of how to use the command.
	Example string

	// ValidArgs is list of all valid non-flag arguments that are accepted in shell completions
	ValidArgs []string
	// ValidArgsFunction is an optional function that provides valid non-flag arguments for shell completion.
	// It is a dynamic version of using ValidArgs.
	// Only one of ValidArgs and ValidArgsFunction can be used for a command.
	ValidArgsFunction func(cmd *Command, args []string, toComplete string) ([]string, ShellCompDirective)

	// Expected arguments
	Args PositionalArgs

	// ArgAliases is List of aliases for ValidArgs.
	// These are not suggested to the user in the shell completion,
	// but accepted if entered manually.
	ArgAliases []string

	// BashCompletionFunction is custom bash functions used by the legacy bash autocompletion generator.
	// For portability with other shells, it is recommended to instead use ValidArgsFunction
	BashCompletionFunction string

	// Deprecated defines, if this command is deprecated and should print this string when used.
	Deprecated string

	// Annotations are key/value pairs that can be used by applications to identify or
	// group commands.
	Annotations map[string]string

	// Version defines the version for this command. If this value is non-empty and the command does not
	// define a "version" flag, a "version" boolean flag will be added to the command and, if specified,
	// will print content of the "Version" variable. A shorthand "v" flag will also be added if the
	// command does not define one.
	Version string

	// The *Run functions are executed in the following order:
	//   * PersistentPreRun()
	//   * PreRun()
	//   * Run()
	//   * PostRun()
	//   * PersistentPostRun()
	// All functions get the same args, the arguments after the command name.
	//
	// PersistentPreRun: children of this command will inherit and execute.
	PersistentPreRun func(cmd *Command, args []string)
	// PersistentPreRunE: PersistentPreRun but returns an error.
	PersistentPreRunE func(cmd *Command, args []string) error
	// PreRun: children of this command will not inherit.
	PreRun func(cmd *Command, args []string)
	// PreRunE: PreRun but returns an error.
	PreRunE func(cmd *Command, args []string) error
	// Run: Typically the actual work function. Most commands will only implement this.
	Run func(cmd *Command, args []string)
	// RunE: Run but returns an error.
	RunE func(cmd *Command, args []string) error
	// PostRun: run after the Run command.
	PostRun func(cmd *Command, args []string)
	// PostRunE: PostRun but returns an error.
	PostRunE func(cmd *Command, args []string) error
	// PersistentPostRun: children of this command will inherit and execute after PostRun.
	PersistentPostRun func(cmd *Command, args []string)
	// PersistentPostRunE: PersistentPostRun but returns an error.
	PersistentPostRunE func(cmd *Command, args []string) error

	// FParseErrWhitelist flag parse errors to be ignored
	FParseErrWhitelist FParseErrWhitelist

	// CompletionOptions is a set of options to control the handling of shell completion
	CompletionOptions CompletionOptions
}
```

Command 的结构比较复杂，不同的字段有不同的用法，我们重点关注 Cobra 启动的流程。我们使用 cobra-cli 创建一个如下的项目:
1. root.go 是 cobra 默认的根 command
2. config 是 root 下的子命令
3. create 是 config 下的子命令

```go
go mod init cobra_test
[tao@master cobra_test]$ cobra-cli init
[tao@master cobra_test]$ cobra-cli add config
[tao@master cobra_test]$ cobra-cli add create -p 'configCmd'

[tao@master cobra_test]$ tree .
.
├── cmd
│   ├── config.go
│   ├── create.go
│   └── root.go
├── go.mod
├── go.sum
├── LICENSE
└── main.go
```

main.go、cmd/root.go、cmd/config.go、cmd/create.go 存在如下的关联:
1. root.go 会定义一个 rootCmd，类型是 cobra.Command，并暴露一个 Execute 函数，其会执行 rootCmd.Execute()
2. main.go 的入口就是调用 root.cmd 中的 Execute 函数
3. config.go 也会为 config 子命令定义个 confgCmd，并在 init 中执行 `rootCmd.AddCommand(configCmd)`
4. create.go 也类似，不过调用的是 `configCmd.AddCommand(createCmd)`

```go
// main.go
import "cobra_test/cmd"

func main() {
	cmd.Execute()
}

// root.go
// rootCmd represents the base command when called without any subcommands
var rootCmd = &cobra.Command{
	Use:   "cobra_test",
	Short: "A brief description of your application",
	Long: `A longer description that spans multiple lines and likely contains
examples and usage of using your application. For example:

Cobra is a CLI library for Go that empowers applications.
This application is a tool to generate the needed files
to quickly create a Cobra application.`,
	// Uncomment the following line if your bare application
	// has an action associated with it:
	// Run: func(cmd *cobra.Command, args []string) { },
}

// Execute adds all child commands to the root command and sets flags appropriately.
// This is called by main.main(). It only needs to happen once to the rootCmd.
func Execute() {
	err := rootCmd.Execute()
	if err != nil {
		os.Exit(1)
	}
}

// config.go
// configCmd represents the config command
var configCmd = &cobra.Command{
	Use:   "config",
	Short: "A brief description of your command",
	Long: `A longer description that spans multiple lines and likely contains examples
and usage of using your command. For example:

Cobra is a CLI library for Go that empowers applications.
This application is a tool to generate the needed files
to quickly create a Cobra application.`,
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Println("config called")
	},
}

func init() {
	rootCmd.AddCommand(configCmd)
}

// create.go
// createCmd represents the create command
var createCmd = &cobra.Command{
	Use:   "create",
	Short: "A brief description of your command",
	Long: `A longer description that spans multiple lines and likely contains examples
and usage of using your command. For example:

Cobra is a CLI library for Go that empowers applications.
This application is a tool to generate the needed files
to quickly create a Cobra application.`,
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Println("create called")
	},
}

func init() {
	configCmd.AddCommand(createCmd)
}
```

## 2. Command.AddCommand 
我们先来看看定义在 Command 上的 AddCommand 方法:
1. `cmds[i].parent = c`: 子 Command 通过 parent 字段指向父 Command
2. `c.commands = append(c.commands, x)`: 父 Command通过 commands 列表关联其所有的子 Command
3. 从这个结构可以看到所有的 Command 构成了一个多叉树

```go
// AddCommand adds one or more commands to this parent command.
func (c *Command) AddCommand(cmds ...*Command) {
	for i, x := range cmds {
		if cmds[i] == c {
			panic("Command can't be a child of itself")
		}
		cmds[i].parent = c
		// update max lengths
		usageLen := len(x.Use)
		if usageLen > c.commandsMaxUseLen {
			c.commandsMaxUseLen = usageLen
		}
		commandPathLen := len(x.CommandPath())
		if commandPathLen > c.commandsMaxCommandPathLen {
			c.commandsMaxCommandPathLen = commandPathLen
		}
		nameLen := len(x.Name())
		if nameLen > c.commandsMaxNameLen {
			c.commandsMaxNameLen = nameLen
		}
		// If global normalization function exists, update all children
		if c.globNormFunc != nil {
			x.SetGlobalNormalizationFunc(c.globNormFunc)
		}
		c.commands = append(c.commands, x)
		c.commandsAreSorted = false
	}
}
```

## 3. Command.Execute 
我们再来看看定义在 Command 上的 Execute 函数:

```go
func (c *Command) Execute() error {
	_, err := c.ExecuteC()
	return err
}

// ExecuteC executes the command.
func (c *Command) ExecuteC() (cmd *Command, err error) {
	if c.ctx == nil {
		c.ctx = context.Background()
	}

	// Regardless of what command execute is called on, run on Root only
  
	if c.HasParent() {
		return c.Root().ExecuteC()
	}

	// windows hook
	if preExecHookFn != nil {
		preExecHookFn(c)
	}

	// initialize help at the last point to allow for user overriding
	c.InitDefaultHelpCmd()
	// initialize completion at the last point to allow for user overriding
	c.InitDefaultCompletionCmd()

	// Now that all commands have been created, let's make sure all groups
	// are properly created also
	c.checkCommandGroups()

	args := c.args

	// Workaround FAIL with "go test -v" or "cobra.test -test.v", see #155
	if c.args == nil && filepath.Base(os.Args[0]) != "cobra.test" {
		args = os.Args[1:]
	}

	// initialize the hidden command to be used for shell completion
	c.initCompleteCmd(args)

	var flags []string
	if c.TraverseChildren {
		cmd, flags, err = c.Traverse(args)
	} else {
		cmd, flags, err = c.Find(args)
	}
	if err != nil {
		// If found parse to a subcommand and then failed, talk about the subcommand
		if cmd != nil {
			c = cmd
		}
		if !c.SilenceErrors {
			c.PrintErrln("Error:", err.Error())
			c.PrintErrf("Run '%v --help' for usage.\n", c.CommandPath())
		}
		return c, err
	}

	cmd.commandCalledAs.called = true
	if cmd.commandCalledAs.name == "" {
		cmd.commandCalledAs.name = cmd.Name()
	}

	// We have to pass global context to children command
	// if context is present on the parent command.
	if cmd.ctx == nil {
		cmd.ctx = c.ctx
	}

	err = cmd.execute(flags)
	if err != nil {
		// Always show help if requested, even if SilenceErrors is in
		// effect
		if errors.Is(err, flag.ErrHelp) {
			cmd.HelpFunc()(cmd, args)
			return cmd, nil
		}

		// If root command has SilenceErrors flagged,
		// all subcommands should respect it
		if !cmd.SilenceErrors && !c.SilenceErrors {
			c.PrintErrln("Error:", err.Error())
		}

		// If root command has SilenceUsage flagged,
		// all subcommands should respect it
		if !cmd.SilenceUsage && !c.SilenceUsage {
			c.Println(cmd.UsageString())
		}
	}
	return cmd, err
}
```

按顺序 ExecuteC 会执行一下核心步骤:
1. 找到 rootCmd 执行 rootCmd 的 ExecuteC 方法
2. 添加 help 子命令: `c.InitDefaultHelpCmd()`
3. 添加 completion 子命令: `c.InitDefaultCompletionCmd()`
4. 找到要执行的子命令: `cmd, flags, err = c.Find(args)`
5. 执行子命令: `err = cmd.execute(flags)`

### 3.1 执行 rootCmd.ExecuteC
```go
	if c.HasParent() {
		return c.Root().ExecuteC()
	}

// Root finds root command.
func (c *Command) Root() *Command {
	if c.HasParent() {
		return c.Parent().Root()
	}
	return c
}
```

### 3.2 找到要执行的子命令

```go
// Find the target command given the args and command tree
// Meant to be run on the highest node. Only searches down.
func (c *Command) Find(args []string) (*Command, []string, error) {
	var innerfind func(*Command, []string) (*Command, []string)

	innerfind = func(c *Command, innerArgs []string) (*Command, []string) {
		argsWOflags := stripFlags(innerArgs, c)
		if len(argsWOflags) == 0 {
			return c, innerArgs
		}
		nextSubCmd := argsWOflags[0]

		cmd := c.findNext(nextSubCmd)
		if cmd != nil {
			return innerfind(cmd, argsMinusFirstX(innerArgs, nextSubCmd))
		}
		return c, innerArgs
	}

	commandFound, a := innerfind(c, args)
	if commandFound.Args == nil {
		return commandFound, a, legacyArgs(commandFound, stripFlags(a, commandFound))
	}
	return commandFound, a, nil
}

// 将命令行参数中的 flag 剔除，只保留包含子命令的部分
func stripFlags(args []string, c *Command) []string {
	if len(args) == 0 {
		return args
	}
	c.mergePersistentFlags()

	commands := []string{}
	flags := c.Flags()

Loop:
	for len(args) > 0 {
		s := args[0]
		args = args[1:]
		switch {
		case s == "--":
			// "--" terminates the flags
			break Loop
		case strings.HasPrefix(s, "--") && !strings.Contains(s, "=") && !hasNoOptDefVal(s[2:], flags):
			// If '--flag arg' then
			// delete arg from args.
			fallthrough // (do the same as below)
		case strings.HasPrefix(s, "-") && !strings.Contains(s, "=") && len(s) == 2 && !shortHasNoOptDefVal(s[1:], flags):
			// If '-f arg' then
			// delete 'arg' from args or break the loop if len(args) <= 1.
			if len(args) <= 1 {
				break Loop
			} else {
				args = args[1:]
				continue
			}
		case s != "" && !strings.HasPrefix(s, "-"):
			commands = append(commands, s)
		}
	}

	return commands
}

// 根据名称找到 Command 中对应的子命令
func (c *Command) findNext(next string) *Command {
	matches := make([]*Command, 0)
	for _, cmd := range c.commands {
		if commandNameMatches(cmd.Name(), next) || cmd.HasAlias(next) {
			cmd.commandCalledAs.name = next
			return cmd
		}
		if EnablePrefixMatching && cmd.hasNameOrAliasPrefix(next) {
			matches = append(matches, cmd)
		}
	}

	if len(matches) == 1 {
		return matches[0]
	}

	return nil
}
```

### 3.3 执行子命令
execute 方法执行过程中，我们看到会调用很多的钩子函数，这些钩子函数都是我们可以在初始化 Command 可以定义的。

```go
func (c *Command) execute(a []string) (err error) {
	if c == nil {
		return fmt.Errorf("Called Execute() on a nil Command")
	}

	if len(c.Deprecated) > 0 {
		c.Printf("Command %q is deprecated, %s\n", c.Name(), c.Deprecated)
	}

	// initialize help and version flag at the last point possible to allow for user
	// overriding
	c.InitDefaultHelpFlag()
	c.InitDefaultVersionFlag()

	err = c.ParseFlags(a)
	if err != nil {
		return c.FlagErrorFunc()(c, err)
	}

	// If help is called, regardless of other flags, return we want help.
	// Also say we need help if the command isn't runnable.
	helpVal, err := c.Flags().GetBool("help")
	if err != nil {
		// should be impossible to get here as we always declare a help
		// flag in InitDefaultHelpFlag()
		c.Println("\"help\" flag declared as non-bool. Please correct your code")
		return err
	}

	if helpVal {
		return flag.ErrHelp
	}

	// for back-compat, only add version flag behavior if version is defined
	if c.Version != "" {
		versionVal, err := c.Flags().GetBool("version")
		if err != nil {
			c.Println("\"version\" flag declared as non-bool. Please correct your code")
			return err
		}
		if versionVal {
			err := tmpl(c.OutOrStdout(), c.VersionTemplate(), c)
			if err != nil {
				c.Println(err)
			}
			return err
		}
	}

	if !c.Runnable() {
		return flag.ErrHelp
	}

	c.preRun()

	defer c.postRun()

	argWoFlags := c.Flags().Args()
	if c.DisableFlagParsing {
		argWoFlags = a
	}

	if err := c.ValidateArgs(argWoFlags); err != nil {
		return err
	}

	for p := c; p != nil; p = p.Parent() {
		if p.PersistentPreRunE != nil {
			if err := p.PersistentPreRunE(c, argWoFlags); err != nil {
				return err
			}
			break
		} else if p.PersistentPreRun != nil {
			p.PersistentPreRun(c, argWoFlags)
			break
		}
	}
	if c.PreRunE != nil {
		if err := c.PreRunE(c, argWoFlags); err != nil {
			return err
		}
	} else if c.PreRun != nil {
		c.PreRun(c, argWoFlags)
	}

	if err := c.ValidateRequiredFlags(); err != nil {
		return err
	}
	if err := c.ValidateFlagGroups(); err != nil {
		return err
	}

	if c.RunE != nil {
		if err := c.RunE(c, argWoFlags); err != nil {
			return err
		}
	} else {
		c.Run(c, argWoFlags)
	}
	if c.PostRunE != nil {
		if err := c.PostRunE(c, argWoFlags); err != nil {
			return err
		}
	} else if c.PostRun != nil {
		c.PostRun(c, argWoFlags)
	}
	for p := c; p != nil; p = p.Parent() {
		if p.PersistentPostRunE != nil {
			if err := p.PersistentPostRunE(c, argWoFlags); err != nil {
				return err
			}
			break
		} else if p.PersistentPostRun != nil {
			p.PersistentPostRun(c, argWoFlags)
			break
		}
	}

	return nil
}
```